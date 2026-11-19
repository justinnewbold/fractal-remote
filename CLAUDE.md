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

**Or build them for testers first, and leave main alone (since 16 November
2026).**

> "Can you do the iphone and android builds as version. 2.0, but leave the
> over the air updates at the intervals we are doing now? I want to test it
> all on test flight first before a public release but i still want OTA
> updates going out in the meantime." Then: "dont change the build number
> to 2.0.0 on the updartes currently going. only after we do the native
> builds"

Merging docs/pending into main moves main's fingerprint, and from that
merge on no update reaches a copy in the stores until its owner installs
the new one. So a test line, with nothing committed for the build:

- *The build*: mobile.yml by hand with platform `all`, profile
  `production`, Send ticked, and three boxes. "Build the next store
  version" (`next_store`) puts every patch in docs/pending into the build's
  checkout, in the README's order (scripts/apply-pending.sh, which stops on
  a patch that neither applies nor is in, and on a patch file with no row).
  "The version number the stores show for this build" (`store_version`,
  2.0.0) sets mobile/app.json's version in that checkout only
  (scripts/store-version.mjs, which refuses anything that is not three
  numbers, a last place of more than one digit, a number below a store's,
  or the App Store's own, a version Apple has closed). "Send
  Android to Google Play's internal testing track" (`android_testing`)
  submits with the `testing` profile: the iPhone to TestFlight as ever,
  Android to Play's internal track, testers only. That profile is itself a
  waiting patch (docs/pending/play-internal.patch), because @expo/fingerprint
  hashes the whole of mobile/eas.json: added to main, it alone moved both
  phones' fingerprints. So the box wants "Build the next store version" too,
  and refuses a build without it. And the other way round: with Send
  ticked, a build of the next store version (or one given a store version
  number) is refused on Android without the testing box, and so is a Skip
  building resend while next-store.json is there (mobile.yml "A next store
  version goes to testers, never to everyone"), since either would go to
  Google Play production, everyone. keep_packages as the build before it
  needed. NOTHING IN mobile/eas.json CHANGES ON MAIN between store
  versions, not even a submit profile. (Since release day for 2.0.0, 17
  November 2026, the `testing` profile IS on main: play-internal went in
  with the other four. It is part of the fingerprint like everything else
  in that file, so it is not a stray to tidy away, and the next build for
  testers first needs no patch for it.)
- *Its ledger*: the first pull request after it is started writes its row
  in docs/expo-builds.md and docs/pending/next-store.json, `{ "version",
  "ios", "android", "watch" }`: the two fingerprints the build carries (its
  runtime version on expo.dev, and what `npm run fingerprint` says with the
  patches in) and the watch's own hash with the patches in.
- *Every merge after that publishes twice*: main's own update, for the
  copies in the stores, then the same commit with docs/pending applied, for
  the testers (the update job's "Publish for the next store version's
  testers", which runs only while next-store.json is there, and only to the
  production branch, which a store build listens on). scripts/next-store.mjs
  says in the log whether that second update still matches the build; it
  stops matching when a patch, a package or anything native changes after
  the build, and then the testers take nothing until another build. Such an
  update is published all the same (it reaches nobody) and THEN the step
  goes red (`NOT_THE_BUILD`, exit 3), so the day it starts is seen; one
  whose fingerprint would be the store copies' own is never published.
- *Release day*, on Justin's word: the pull request that applies
  docs/pending to main the usual way (README steps, the version to the
  store build's or past it), deletes the patch files AND next-store.json,
  and records the new fingerprint, which has to BE next-store.json's on
  both phones (and the watch's hash its own) before that file goes: if not,
  the build he sends for review takes no update from the merge on, and
  that is another build, not a release. He then sends the builds the testers
  already have: the iPhone's from TestFlight for review in App Store
  Connect, Android's with Promote release from internal testing to
  production in Play Console. No new build, and from that merge on main's
  updates reach only the new store version, as at every store version.
- *RELEASE DAY FOR 2.0.0 WAS 17 NOVEMBER 2026.* "I'm gonna go ahead and
  submit the build to Apple. Go ahead and submit the android build now. for
  2.0.0. Enable all new features for all users that were on my account.
  Except for the scroll wheel for presets, I wanna just get rid of that
  altogether." In two pull requests, in this order, so that a red check on
  the first could only ever be about the build matching. ONE, release day
  itself and nothing else: the five patches into main in the README's order
  (scripts/apply-pending.sh, then `npm ci` in mobile from the patched lock,
  never `npm install`, which may write the lock again), `npm run notices`
  for the four packages they bring (which also brought the list level with
  the lock: it had gone stale, and still showed the camera's packages, out
  since the picker took their place), the app's number to 2.0.0, and the
  fingerprint recorded, which IS the build's (ios 9d75d6bd…, android
  e44134a7…, watch 34149f04…: `node scripts/next-store.mjs --strict` said
  "the 2.0.0 build's own" three times BEFORE next-store.json was deleted;
  once it is gone web.yml's `testers` job passes without checking anything,
  and the only proof left on GitHub is mobile.yml's fingerprint step
  against the recorded file, so read that file's diff against the three
  values by eye). The patch files and next-store.json went in that same
  change, and three tests that read the watch's patch read the watch's own
  files now. From that merge on main's updates reach the 2.0.0 copies only
  (TestFlight build 33, Play's internal testing, the stores' once approved,
  and the public apk-v2.0.x files), every merge publishes once again, and
  the App Store's and Google Play's 1.90.0 copies keep update 1.92.7 until
  their owners take 2.0.0. TWO, straight after and BEFORE he presses
  Submit: the pull request that opens what was his account's to everyone
  (below, each feature's own section). It could not go first: merged before
  release day, an update reaches the 1.90.0 copies, which were reviewed
  with notes that say there is no saving and no moving blocks over
  Bluetooth. And not after Submit: an update then reaches the copy Apple is
  reviewing. NOTHING IS WAITING in docs/pending now. Still his: build 33
  into a 2.0.0 version in App Store Connect with its notes (docs/app-store.md),
  Promote release in Play Console, and public/store-versions.json moves on
  each store's live day, not before. STILL OPEN from the test line, both
  below: no Android phone on the 2.0.0 build has been seen connecting
  through a computer, and why his iPhone once would not turn.
- A patch changed after the test build means the testers' copy no longer
  matches it, so that change waits for release day or for another build.
  web.yml's `testers` job holds every pull request to that while
  next-store.json is there: the patches in, the app's packages, and
  `node scripts/next-store.mjs --strict`, which fails unless both phones'
  fingerprints and the watch's hash are the build's. A pull request that
  only touches docs/pending says Unchanged everywhere else, so without it
  one would go green and be merged, and the testers would quietly take no
  more updates (an independent read, before the 2.0.0 pair). Wanted all
  the same, it is another build: his yes, the new values written into
  next-store.json on purpose in that pull request, the build right after.
- *The number the app shows on a test copy is the update's*, 1.92.x, not
  2.0.0: he asked for that ("dont change the build number to 2.0.0 on the
  updartes currently going"), and then asked about it (17 November 2026:
  "even though I've downloaded the 2.0.0 build on iPhone, it still says
  1.92.5. Is that what it should say?"). Yes. 2.0.0 is the build's number,
  which TestFlight and Google Play show for it, and a report's head says
  it as "store copy: 2.0.0". The app's own number becomes the store
  build's, or past it, with the release-day pull request. On an iPhone a
  phone turning on its side on Play is itself a sign of the 2.0.0 copy:
  the 1.90.0 one has no package to turn it.
- *Google's own test machines sent a report from the 2.0.0 Android build,
  and it is NOT SETTLED* (report a345130c, 16 November 2026, 20:37 UTC: a
  OnePlus 8 Pro on Android 11, its message nothing but the sign-in's
  address, typed by a robot). When a build reaches a Play track, Google
  runs it on machines of its own, signed in with the review login; six to
  eight of them that evening, from Google's own network. On every one the
  relay never joined: the connection to the server was made each time (the
  server's log has every upgrade answered), and a fraction of a second
  later the socket itself errored, for as long as the robot stayed. The log
  said only "channel error: transport failure", the one sentence the
  relay's library has for any error of the socket, so it could not say
  why. WHAT IS KNOWN: the account was entitled; real Android phones joined
  the relay on the 1.90.0 store build on 14, 15 and 16 November (What
  works, and the server's log); nothing in the waiting patches touches the
  network. WHAT IS NOT: whether it was Google's network or the 2.0.0
  Android build, because no Android copy of 2.0.0 has been seen joining
  from an ordinary network. Before release day, one Android phone on the
  2.0.0 test build has to be seen connecting through a computer. Since
  1.92.5 the log has a line of its own for it, for every account, one for
  each connection that errors and then closes: "[relay] socket closed
  after an error — 1006 (Connection reset)"
  (mobile/src/lib/socketWatch.js). On a phone the system says why in the
  CLOSE that follows the socket's error (React Native: an error with no
  words, then a close, code 1006, whose reason is the system's sentence
  where it has one), and the relay's library tells the channel about the
  error only, so the reason is heard through the library's own socket log
  (`realtime: { logger }` in lib/relay.js) and nowhere else. A first cut
  read the channel's error for it, and an independent read showed no phone
  puts it there; test/socket-watch.mjs drives the real library with the
  events in a phone's order, and a second read checked that order against
  React Native's own source for both phones. "1006 (no reason given)" IS
  AN ANSWER, NOT THE LINE FAILING: Android hands up the failure's message
  and nothing else, and a connection dropped with no close (OkHttp's end
  of stream) has none, which is one possible shape of Google's report. The
  kind of failure behind it would need a native change, so a build. The
  reason is the system's own words put on one line (no control or
  direction characters), cut at 200 characters with a mark, with the
  device's own address left out where Android writes it; it can name the
  server and its address and what a server or a network in between
  answered, and nothing in it comes from the sign-in. A close with no
  error before it is not this line's: the library hands it to the channel
  where the channel has not errored already, and relay.js writes the
  channel's code and reason during a join and when a joined channel drops
  (not for the library's own rejoins in the seconds before the app's next
  join), so the same close is not said twice. READ THAT LINE FIRST in any
  report where the link stays on "joining". NOT SEEN ON A PHONE YET: the
  first report with one is the check.
- *His iPhone would not turn on its side on the 2.0.0 test build, then did
  the same day, and WHY IS NOT SETTLED* (17 November 2026: "It's not
  working on my account on the 2.0.0 build", then "It does not turn it
  all. And I've confirmed that I can turn landscape in other apps on my
  phone"; an iPhone 17 Pro Max on iOS 27.2.1, TestFlight build 33, his
  account, on Play). It is the first look at phone-turns on a real phone,
  one of the five waiting patches the build carries. LATER THAT DAY IT
  TURNED: "OK, I just tried the landscape view again and now it's
  working." The app said 1.92.5 on that phone then, so 1.92.6's line
  (below) had not reached it, and 1.92.6 only reads: nothing sent for this
  made it turn. He had just been asked whether the phone's own Portrait
  Orientation Lock was on, and did not say; which update the phone was on
  when it would not turn was not said either. So there is no log from a
  try that failed and none from the one that worked, and what follows is
  what was known and tried while it would not. AND THE SIDEWAYS LAYOUT HAS
  NOW BEEN SEEN ON A REAL iPHONE: minutes later he sent a picture of Play
  on its side ("That's on 1.92.6"; the same phone, his Axe-Fx III through
  the Raspberry Pi): the eight scenes on the left in two rows of four, the
  chain on the right, twelve blocks in three rows of four, the top bar
  over both and the five buttons under them, and both ends kept clear of
  the island. The scenes' two rows end about two thirds of the way down,
  with nothing under them, where the chain's three rows fill the height:
  that is how the layout draws square tiles, he has not said anything of
  it, and he was offered taller scenes. Seen once, on Play alone, with
  nothing open beside it; not yet with a tool beside Play, in Stage view,
  or on Android. IF IT STICKS UPRIGHT AGAIN, the report he sends then has
  the line, and that line is the first thing to read. WHAT IS KNOWN: the
  package is in the build and the app asks, and the package takes it (his
  log of 16 November, report 8be38966: "turning: upright" at launch and
  "turning: turns" a moment later, twice); build 33's own Info.plist, read
  out of the build file itself that day (the .ipa on expo.dev: 2.0.0 (33),
  built with Xcode 27.1), is the one a prebuild of the same config and
  patches makes: it lists upright and the two sides and starts upright,
  and the package is in its binary; nothing else in the app answers iOS
  about ways up (no react-native-screens, in that file either: its one
  "RNSScreen" is the package's own look for it; every pop-up passes all
  four ways); no crash has been sent from that build through TestFlight.
  WHAT IS NOT: what iOS was holding after the ask, since the log could not
  say; there is no log from a run in which he tried to turn it; and
  whether the phone's own Portrait Orientation Lock was off (he turned
  other apps, and an app that forces landscape, a full-screen video say,
  turns with that lock on; which apps was not asked). SINCE 1.92.6 THE LOG
  SAYS IT, after every ask the phone takes: "[app] turning: after "turns"
  — the phone holds lock 0, ways 1,3,4, way up 1" (lib/turnScreen
  `sayTurn`, which only reads; the numbers are the package's own, and the
  file's note says each). READ THE LAST SUCH LINE FIRST in his next
  report: "lock 0, ways 1,3,4" on a phone that still does not turn is iOS
  not acting on what the app told it, which is also exactly how the
  phone's own Portrait Orientation Lock looks from inside the app, so ASK
  HIM THAT FIRST, in plain words, if that is the line; "lock 3, ways 1" is
  the app held upright all the same (something else asked, or the package
  holds nothing of this app's and fell back to how it starts); "lock 8,
  ways none" is no key window found when it was asked, so at that moment
  the app would have answered iOS with no way up (iOS asks again on its
  own, and may get another answer). The same line is written when the app
  goes onto its side or back ("the app is on its side now, 956×440"), when
  a phone on its side measures too narrow (it is upright for the rest of
  that run after that, by the rule), and when the iPhone comes back to the
  front. ON A SIMULATOR, free, on GitHub's Macs, THE 2.0.0 BUILD TURNS, ON
  iOS 27 TOO (17 November 2026; .github/workflows/turn-check.yml with
  mobile/turn-check, kept in the repository since 1.92.7 and started by
  hand from Actions, or by a push to the working branch that changes its
  files: the next store version's native side with a small stand-in for
  the component, put in PhoneTurns.js's place in the runner's copy only,
  which asks as the app does at launch, upright and then "turns", for
  every account, over the first screen). Built with Xcode 26.6 on an
  iPhone 17 Pro Max with iOS 26.5, the app followed the simulated phone
  onto its side and back in all four ways it was tried (the app's own
  order; "turns" alone; with no starting way up in Info.plist; a landscape
  lock asked outright). Built with Xcode 27.1, the store build's own
  (mobile/eas.json), on an iPhone 18 Pro Max with iOS 27.2, it did the
  same in those four and in a fifth with expo-updates left on as the store
  build has it, so started the way a store copy starts: the window went to
  956×440 and back each time, reading "lock 0, ways 1,3,4" after "turns".
  (On that image the Simulator has to be opened by its path, and with no
  window to click the simulated phone is told which way up it is held:
  notifyutil on com.apple.backboardd.rawOrientation, 4 and then 1. A round
  before that proved nothing there, because the simulated phone was never
  turned.) A FOURTH ROUND THE SAME DAY, on that Xcode 27.1 build and
  simulator, tried what a phone in use does and the first three never did.
  ONE, THE APP RESTARTING ITSELF FOR A NEW VERSION, as lib/updates
  applyNow does (expo-updates reloadAsync), with upright the last thing
  asked before it and, as a control, with "turns". His log of 16 November
  reads as one (his second run began 16 s after the first one's last line,
  with 38 ms between "upright" and "turns" where the run before it had 1.3
  s; the log itself does not say how either began). The package keeps one
  mask for each module, allows only what every mask allows, and lets go of
  a module's mask when the module is destroyed, so an upright that
  outlived a restart would have held the app upright whatever was asked
  after. IT DOES NOT OUTLIVE IT: the second run read "lock 3, ways 1"
  before it had asked anything and after "upright", "lock 0, ways 1,3,4"
  after "turns", and followed the simulated phone onto its side and back.
  TWO, LEAVING THE APP AND COMING BACK (another app opened over it, then
  the app brought to the front again). In the background the package holds
  nothing of the app's and read "lock 3, ways 1", which is how the app
  starts; back at the front it read "lock 0, ways 1,3,4" by itself, with
  nothing asked, and where the phone was upright it turned again. That
  round ran five ways (the app's own order with expo-updates off and on,
  the two restarts, and a restart by expo's own reload with expo-updates
  off, whose first seconds were not in the kept log), and every one
  turned; after coming back four turned again, and in the fifth (the app's
  own order, expo-updates off) the simulator's own command to turn the
  phone back had timed out, so the app left on its side and came back on
  its side, still 956×440 and "lock 0, ways 1,3,4". SO NEITHER THE BUILD
  AND ITS SETTINGS, NOR A RESTART, NOR A TRIP AWAY FROM THE APP IS WHAT
  STOPS IT, on a simulator. So in his log a "back at the front" line on
  Play should read "lock 0, ways 1,3,4"; "lock 3, ways 1" there would mean
  his phone's package did not ask again by itself as a simulator's does,
  and the fix is to ask again from the app when it comes back, as
  components/PhoneTurns already does on Android: an update. WHAT IS LEFT,
  on his phone: the app's real component and screens with his account
  signed in on Play (the stand-in is not the real rule, and nothing was
  signed in); iOS on a real phone; or the phone's own Portrait Orientation
  Lock. His next report says which. A fix in the app's JavaScript is an
  update; one in the native side is another build pair, and his yes.

**Everything that was his account's is open to every account since 2.0.1
(17 November 2026), on a 2.0.0 copy. The preset wheel is gone.**

> "Enable all new features for all users that were on my account. Except
> for the scroll wheel for presets, I wanna just get rid of that
> altogether." (17 November 2026, release day for 2.0.0)

Eighteen switches went to true in one pull request, the one straight after
release day's and before he sent the builds for review:

- in mobile/src/lib/features.js: `SAVE_OVER_BLUETOOTH`, `CHAIN_OVER_BLUETOOTH`,
  `QUICK_BUILD`, `BLOCK_ORDER_FROM_GRID`, `LIVE_KNOBS`,
  `OUTPUT_AND_SCENE_LEVELS`, `EDIT_SETTINGS`, `OWN_BLOCKS_THROUGH_COMPUTER`,
  `NAM_PICKER`, `TONE3000_QUICK`, `PHONE_SIDEWAYS`, `WATCH_QUICK_EDIT`,
  `METRONOME_FLASH_CHOICE`, `METRONOME_LINE_UP`, `BEAT_LOCK` and
  `COMPUTER_UPDATE`, each `_FOR_EVERYONE`;
- for the browser and the computer's own window, which made a computer
  release: `OWN_BLOCKS_ON_THE_WEB_FOR_EVERYONE` (shared/own-blocks.mjs) and
  `PHONE_SIDEWAYS_ON_THE_WEB_FOR_EVERYONE` (src/lib/sidewaysPlay.js). Both
  are open to a visitor who is not signed in and to the demo as well.

Each feature's own section, below, still says what it is, and its heading
says when it opened. What matters across all of them:

- **A plain switch was enough, and only because of the order.** Several of
  these sections say "opening it to customers is a store version, never the
  switch alone", and asked for a key to the store version as Edit has
  (`EDIT_FROM_STORE`). No key was made. Release day's merge moved main's
  fingerprint to the 2.0.0 build's, so from it on an update reaches a 2.0.0
  copy and no other: TestFlight build 33, Play's 2.0.0, and the public
  apk-v2.0.x files, which are 2.0.0 copies too. The 1.90.0 copies, reviewed
  with notes that say no saving and no moving blocks over Bluetooth, are
  frozen on update 1.92.7 and can never be handed any of this. And the
  2.0.0 notes describe every one of them (docs/app-store.md, *2.0.0*). SO
  THE RULE FOR THE NEXT ONE IS UNCHANGED: something new for customers that
  a copy's review notes do not describe still waits for a store version, or
  is keyed to one. This day does not make switches a way round that.
- **Build 33's own copy has every one of them off.** A copy runs what is
  built into it on its first launch and has the update by the next, so a
  fresh install shows none of this for one launch. The review notes say so.
- **More than the switch, in three places.** (1) The capture tools' wire
  gate, lib/bluetooth `capturesOverBluetooth` (his account, or either of
  `NAM_PICKER` and `TONE3000_QUICK`), handed to the wire as `captures`:
  until then the list, the pick and the send answered his account alone
  over Bluetooth or the cable, so the switches by themselves would have
  drawn buttons that did nothing there. `reader` (the Block reader) beside
  it is still his alone, and a test holds that opening the one does not
  open the other. Through the computer there was never an account gate on
  the capture routes, only the phone's own hooks. (2) Words that did not
  follow a switch: Edit's line under More and the Bluetooth page's list say
  that Quick build fills an empty preset and that moving, adding or
  removing a block in a chain that has blocks still needs the computer;
  the "save it on the unit" notes are not drawn where the app saves. (3)
  The computer update's two sentences are by whose computer it is
  (lib/hostUpdate `owner`, from the device's own sign-in): a customer's
  waits a day after a release and is told so in both; his own does not, and
  is not told of a wait it does not make.
- **TONE3000 was made fit for a customer the same day**, by what the
  guideline pass found:
  - *A way to sign out* (Apple's 5.1.1(v)). Settings → My rig → TONE3000,
    drawn only while a TONE3000 sign-in is kept on the device, for any
    account: "Signed in as @name · tap to sign out", a confirm, and the
    pass is removed. The held-block pop-up still has none, on purpose (an
    earlier read took it out). And the app's own goodbyes end it too:
    `forgetTone3000()` right after each of the five
    `allowBluetooth(null, { signedOut: true })` calls in App.js (the
    sign-in form, the purchase page's three, and Settings' Sign out, which
    Delete account goes through).
  - *The page forgets too, where there is something to forget.* The web
    view keeps TONE3000's own website login, which the app cannot empty, so
    a sign-out on a device where TONE3000's page has been shown
    (`fractal.tone3000.shown`), or where a pass is kept, makes the page
    private from then on (`fractal.tone3000.private`, the web view's
    `incognito`; lib/tone3000Keep `signOutKeeper`), and the next person is
    not handed the last one's TONE3000 account. A device that never opened
    the page is left as it was (a first cut made every device private the
    first time anybody went to the sign-in form; an independent read found
    it). The cost where it applies: each later TONE3000 sign-in on that
    device asks for the email and the code again, and going to the app's
    sign-in form and back ends the TONE3000 sign-in. That reverses the
    older "never a private window" test on purpose. ON ANDROID A PRIVATE
    PAGE IS LESS THAN ON AN iPHONE: the package empties cookies, the cache
    and form data each time the page opens, not the page's local storage,
    where an iPhone gives it a separate store. TONE3000's site keeps its
    sign-in in cookies, so that is believed enough and has not been seen on
    an Android device; the privacy page promises only what the code does.
  - *Only TONE3000's pages load inside the app* (2.3.6, the age rating's
    "no unrestricted web access"). lib/tone3000Page `pageRule`: the return
    address; https on www.tone3000.com or tone3000.com; any other https
    page is handed to the device's own browser; everything else (http,
    mailto, intent, javascript and the rest) is refused. The web view's own
    list is `['*']` so that every address reaches the rule: with a narrower
    list the package itself opens whatever is not on it in the browser.
    One tap opens the browser once (the same address again within two
    seconds is not opened twice), and Android, which cannot say whether a
    question is the whole page's or a frame's, keeps a frame's inline
    pages (data: and blob:).
  - *The privacy page* has a TONE3000 section and names it among the
    services (5.1.1(i)). It is inside the computer app, which opens it from
    The small print, so it made a computer release.
  - NOT KNOWN, because nobody can run TONE3000's live sign-in here: whether
    it ever moves the whole page through another host (that step would
    open in the browser and the sign-in would not come back to the app),
    what Android does with a frame on another host, and whether a private
    page disturbs the sign-in. THE FIRST SIGN-IN ON A 2.0.1 COPY IS THE
    CHECK: if the page will not finish, `pageRule` is the first thing to
    read, and loosening it is an update.
  - Not built, and Apple's or TONE3000's to raise: a "Report on TONE3000"
    link on each tone (Apple's 1.2), TONE3000's logo, its Favorites,
    Created and Downloaded lists, and the catalogue page.
- **What customers have now and nobody has seen on a unit.** He chose to
  open it all; no screen, store text or email says any of it was tried.
  When a report comes in, this is the list to read first:
  - *Save from the phone*: nothing has ever been saved from the phone to a
    unit, on any of the four. A save writes over the preset the unit is on.
  - *A chain built over Bluetooth*: once, his Axe-Fx III through a WIDI
    Master, on row 3. Never another row, an FM3, FM9 or AM4, another
    adapter, an Undo, a cell emptied or a cable parted.
  - *Quick build*: his Axe-Fx III has joined row 3 four times (once over
    Bluetooth, three through the Pi). Through a computer app older than
    1.90.82, a six-row preset whose ends are on row 2, 5 or 6 is built and
    not joined, and nothing tells that player to update (`COMPUTER_NEEDED`
    was left at 1.87.23 on purpose: the card says the row is not joined).
  - *Blocks in the unit's own order over Bluetooth*: no unit has answered
    that read from a phone, and an Axe-Fx III's answer has never been seen.
  - *Knobs that follow the unit*: never watched, and nobody has listened
    for whether a read every few seconds is heard. The cost left when it
    was built stands: a Play tap that lands just after such a read has
    started waits for it, 0.3 to 0.9 s.
  - *The Output block's and the scenes' levels, IN and OUT, the volume
    button over Bluetooth*: none of it seen on a unit.
  - *A block's list settings in Edit*: no setting tapped on a unit.
  - *The capture picker*: no list read and no capture picked from Edit on
    a unit. *TONE3000*: two captures kept through the Pi on computer app
    1.90.90; over Bluetooth, no search for an empty slot and no whole send
    has been seen since the fixes; its sign-in page inside the app has been
    seen once, on his Android phone on the 2.0.0 copy (17 November 2026,
    signed in, then a Preview kept in slot 050 through the Pi), never on an
    iPhone; and the block switched on for a preview (1.92.7) has not been
    run. Every Preview and every Get fills a slot on the unit
    for good.
  - *Own blocks through a computer*: NAM placed and switched on his
    Axe-Fx III through the Pi; the other five never switched that way, and
    never from the browser or the computer's window.
  - *The metronome*: the flash and sound choices never seen on a phone;
    line-up and Tap along never against a unit's click; whether any unit
    sends its beat at all is not known (with none heard, nothing changes).
  - *A phone on its side*: seen once, on his iPhone, on Play alone. Never
    beside a tool, in Stage view, on an Android phone or in a phone's
    browser; and why his iPhone once would not turn is not settled.
  - *The watch's quick edit*: compiled on GitHub, never run on a watch.
  - *Update now*: never pressed on a real Raspberry Pi.
- **Still his alone**, and meant to be: the Developer pages (messages,
  customers, sales, trials, access, app health, testing tools), the Block
  reader, Developer → TONE3000 (the card with the sender), the Axiom
  switch, and settings that are measured and never written back.
- **If one has to be shut again**, its switch goes back to false in an
  update, and the feature is his account's again that day. That is the
  emergency way and it is allowed (shutting is not switching on), but it
  takes from customers something their copy was reviewed with: tell him
  first, in plain words, and say which.
- **Left for each store's live day**, as at 1.90.0, because a merge
  publishes the website before either store has approved 2.0.0:
  public/store-versions.json; public/bluetooth.html and public/support.html,
  which still say there is no saving over Bluetooth (true of 1.90.0, which
  is what the stores offer until then); the setup email's "with no saving"
  (his yes and a redeploy); the Google Play description (when he asks).

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
  Jack, the FM3 through the WIDI Uhost with a CME U2MIDI Pro, and, a
  customer's, through a Yamaha MD-BT01 and a WIDI Jack, which gets hot
  (Justin, 15 November 2026; which phone was not said); the Axe-Fx
  III from an iPhone (31 October 2026, adapter not said, "It just works
  probably with all the connectors"); the FM9 ("FM9 has already been tested
  and works", 1 November 2026, phone and adapter not said). Not the VP4.
  Still never
  a sentence that says it works on a unit it has not run on.

  **And the app's own notes can be read for it.** "We have the data to tell
  what units have been used recently and what Bluetooth devices have been
  connected correct? Can we go through the logs to find what has worked
  with what devices so far and update our list?" (15 November 2026.) What
  works (public.gear_reports) is anonymous notes from the people who said
  yes: the unit, through a computer, Bluetooth or a USB cable, the
  adapter's or the cable's name, whether the unit answered, the kind of
  phone. When he asks, read it as counts only (group by unit, way, adapter,
  outcome and phone; docs/bluetooth-midi.md has the query and the count of
  15 November) and update `TRIED_WAYS` and `TRIED_NOTES` from it. That read
  added an FM9 through a WIDI Master and an Axe-Fx III through a WIDI
  Uhost, each from an iPhone. Mind what a note is not: it has no name on
  it, so many are his own rig; it has the adapter's name and never the
  cable on a Uhost; and "not answering" is one try, often the same person
  a minute before it answered. He sees the same notes on Developer → What
  works.
- **The FM3 is the only unit with a heat warning.** "The FM three is the
  only one that ever has overheating issues so we don't need to worry
  about it for any other devices" (31 October 2026). So no heat check for
  any other unit. The FM3's stays red and in front of it, and since 15
  November 2026 it is a warning, not a never:

  > "In addition to what we already confirmed works, I have now confirmed
  > that from a user that The Yamaha B101 works also in addition to the
  > WIDIJack that works but gets hot. So On the FM3 Instead of saying NEVER
  > use a different Bluetooth device, just have a warning that devices on
  > the FM3 may overheat and to use at their own risk."

  ("B101" is read as Yamaha's MD-BT01, and both reports as on an FM3.) So
  one sentence, `FM3_WARNING` in shared/bluetooth-gear.mjs (`FM3_SHORT` on
  the website): an adapter may overheat on an FM3, use one at your own
  risk, unplug it if it gets hot; the Uhost with the U2MIDI Pro runs on USB
  power only and stays cool; the WIDI Master and the C2MIDI Pro got very
  hot and did not work. No screen or page tells an FM3's owner "never",
  and the app refuses no adapter for an FM3 by its name (it used to: never
  chosen, offered or switched to). The FM3's adapters on How to connect are
  the Uhost with the U2MIDI Pro first, then the Yamaha MD-BT01 and the WIDI
  Jack, each with a yellow line to feel it in the first few minutes; never
  steps for the WIDI Master or the C2MIDI Pro on an FM3, which did not
  work. Still never a sentence that says an adapter stays cool or works on
  an FM3 but the U2MIDI Pro. The setup email's FM3 sentence is the
  server's, and changes only with his yes and a redeploy; it said "never
  the C2MIDI Pro or a WIDI Master" until 16 November 2026, when he gave
  that yes ("You're good to update the email that we talked about"), and
  says the same warning now (`FM3_HEAT` in the function). The Google Play
  description still said "Never plug the C2MIDI Pro or a WIDI Master into
  an FM3" that day: it changes only when he asks for it on Google Play.
- **Setup and Troubleshooting are by unit and by adapter, in tabs.** "With
  tabs so we don't have to sort through so much information not relevant
  to the unit and device they are using" (15 November 2026). How to connect
  my Bluetooth device and Troubleshooting Bluetooth show the unit's chips
  (the real pick, shut while Bluetooth is on), then that unit's adapters as
  tabs (components/Tabs; `adapterTabsFor`, and which opens, `adapterTabFor`:
  the kept adapter's own, by its name), and under them one adapter's parts
  and steps (`waysFor`) or its fixes (`troubleFor`). A tab is looking only:
  it never changes what the app connects to. A new adapter is a way in
  `waysFor`, a name in `ADAPTER_NAMES`, a tab in `ADAPTER_TABS` and its
  lines in `troubleFor`; test/bluetooth-tabs.mjs fails on lines under one
  tab that name another adapter or another unit. The website's guide stays
  short and has no tabs.
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
  THE ONE EXCEPTION, ON HIS WORD, FOR ONE VERSION AT A TIME (17 November
  2026): "Are you sure you can't edit those lines for me? I believe you
  can", of the 2.0.0 review notes, What's New and one sentence of the
  Description. The same workflow's "A new version's texts" box
  (scripts/store-release.mjs, from store/app-store/<version>.json) makes
  the version in App Store Connect, attaches the build, writes What's New
  and the Description's sentence swaps, and changes the review notes in
  place inside the job, never printing them (they hold his private links
  and the review login). It never presses Add for Review, which stays his,
  with the questions Apple asks there. Run it unticked first, and with
  Write it only for a version he has asked for; the promotional text and
  everything on a live version are still his alone. 2.0.0 was written that
  way that day (run 44194040313: version made, build 33 attached, texts
  read back the same). Apple's key answered 401 once earlier that day and
  was fine on the next try: try again before calling a key dead.
  AND SCREENSHOTS THE SAME WAY (17 November 2026): "Add these iPhone
  screenshots to App Store Connect", then "Same with Google, if you can.
  You might need to crop them so it doesn't look like Apple". His own
  pictures are kept in store/app-store/screenshots/<version>/iphone/ as
  they came off his phone, and in store/google-play/screenshots/<version>/
  phone/ cropped of the iPhone's clock row and home bar (1320x2640, which
  is also Play's limit: the long side no more than twice the short). The
  store-text workflow's Screenshots box (scripts/store-shots.mjs) and
  play-text's `screenshots` mode ADD them after the ones already there,
  never twice, never in place of one, and stop at Apple's ten or Play's
  eight: which old one goes is his to say. An iPhone picture is never
  stretched or padded into an iPad one (Apple refuses listings for it);
  the iPad's pictures are real iPad screenshots.
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
    other five blocks in the list (below), is true since 16 November 2026
    (1.91.2, "Yes, open the knobs for everyone now"). lib/bluetooth turns
    them into one answer (`ownKnobsLevel`), asked by the wire at each
    request and each send: `true`, the whole list (axefx3-edit `withNam`,
    named from when NAM was alone in it), his account's and, since
    `OWN_KNOBS_FOR_EVERYONE` is on, everybody's; `'nam'`, the NAM block
    alone (`namOnly`), which every other account had until 16 November
    2026; false, the codec's catalog as it was. `OWN_KNOBS_FOR_EVERYONE`
    is asked first, so WHILE IT IS ON THE NAM SWITCH DECIDES NOTHING:
    turning `NAM_KNOBS_FOR_EVERYONE` off alone closes nothing, and taking
    the NAM block's knobs back to his account means turning both off.
    Where a block is not in the account's Edit it is
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
    capture is chosen on the unit (lib/gen3Catalog `NAM_ON_THE_UNIT`),
    except where the capture picker is drawn (his account, below, under
    TONE3000): the capture still has no row in Edit's list, and is picked
    by the captures' own write, never Edit's.
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
    them. TURNED ON HIS AX3 AND RIGHT, 16 November 2026: "I verified knobs
    are working correctly on the 5 AX3 blocks" (Justin; which connection
    he used, over Bluetooth or through the Pi, was not said, and no log
    came with it). OPEN TO EVERY ACCOUNT SINCE 1.91.2, the same day: "Yes,
    open the knobs for everyone now" (`OWN_KNOBS_FOR_EVERYONE`, true). Over
    Bluetooth or the unit's USB cable only, where Play already draws these
    blocks for everybody; through the computer they are still New blocks
    to every account but his (`OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE`),
    and their list settings are his (`EDIT_SETTINGS_FOR_EVERYONE`). An FM9 has no hand-written
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
    for its place) is taken there. A NAM's knob was never sent the typed
    way, and since 16 November 2026 no gen-3 knob is (gen3-edit "ONE WAY
    ONLY", below under "What made knobs not take"). NOT TURNED YET: the NAM
    block's six switches (Edit draws none, so there is nothing to tap).
    The knobs of the other five blocks in the list, which have a switch
    of their own (`OWN_KNOBS_FOR_EVERYONE`) and did not open with the NAM
    block's, were turned on his AX3 on 16 November 2026 and opened to
    every account the same day (above).
- **A block's list settings in Edit, under its knobs: built 13 November
  2026, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then)** ("Yes, I like B for the edit screen" and "Menu
  style B", of three ways shown on a NAM block; the picture is in the
  session's scratchpad, not the repository). Edit drew knobs and nothing
  else; every setting that is one of a list (Bypass Mode, Tone Stack Type,
  Input Mode) came with each block's read, in `enums`, and had nowhere to
  go. Now, under the knobs and the Level of the page showing, a SETTINGS
  heading and one entry a setting (mobile/src/lib/editSettings.js,
  components/BlockSettings.js): two or three choices are buttons, one tap
  (`SHORT_MOST`); more is one button with its name over the choice it is
  on, which opens a list (with a find box from thirteen choices).
  - *The switch* is `EDIT_SETTINGS_FOR_EVERYONE` in features.js, true since 2.0.1 (false until 17 November 2026):
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
  - *They are short buttons.* "Make these buttons a little bit smaller
    they're kind of big" (14 November 2026, of a NAM block's page): a
    choice is 44 points tall, as Copy channel under it, and the button
    that opens a list 48 (`SETTING_TALL`, `SETTING_LIST_TALL` in
    lib/editSettings). Not the full button height again.
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
    FM9, Edit gives each its on and off. The switches (1.90.52) and the
    NAM capture picker (1.90.63) are both built since, his account only.
    Which of the Crossover's four levels and four pans is which was
    settled by the codec's mined table (above), not by a read.
  - *Through the computer the phone names them itself, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then)*
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
    `OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE` in features.js, true since 2.0.1 (false until 17 November 2026);
    nobody has switched one through a computer yet, and his Raspberry Pi
    is the first check. Edit through the computer for these blocks came in
    1.90.51 (above): the engine serves their knobs, and the phone still
    names them.
  - *The browser and the computer's own window name them on Play too, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then)* (1.90.56). "Nam blocks are showing in the APP but not
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
    The switch is `OWN_BLOCKS_ON_THE_WEB_FOR_EVERYONE` in that file, true since 2.0.1 (false until 17 November 2026)
    (`ownBlocksOpenTo(link.account?.id)`). It is inside the computer app,
    so it came with a computer release, and a change to the list is one
    too: KEEP IT IN STEP WITH mobile/src/lib/gen3Catalog.js `OWN`.
  - *AND THE CHAIN EDITOR CAN ADD, MOVE AND REMOVE THEM, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then)
    (1.90.75).* "Looks like NAM blocks and some others are missing from
    the chain editor when adding new blocks not currently in the chain"
    (15 November 2026). The editor works through the computer only, and
    its list of blocks to add is the computer's (GET /blocks), which the
    engine builds from a codec table that stops before these blocks
    (forgefx-midi `EFFECT_BASES`: no NAM, IR Player, Vocoder, Crossover,
    Tone Match or Dynamic Distortion). The engine's route that PUTS a
    block in a cell takes any effect id, so nothing changed on the
    computer: the phone adds its own names to the list
    (mobile/src/lib/ownBlocks.js `ownInPalette`) and the browser the same
    (shared/own-blocks.mjs), held equal by a test, and a block of theirs
    that is in the chain is the editor's own to move and remove
    (`ownInChainEditor`; it was held as a "New block" with nothing to
    press, which would have left a NAM just added with no way out). Only
    the editor is handed that copy: Edit, the report and the rest still
    see the block as they did. NOT PROVEN ON A UNIT: nobody has seen an
    editor place one of these with that message, and the second of each
    kind (NAM 2, IR Player 2 to 4, and so on) is the id after the first,
    never read off a unit. The editor re-reads the chain after every add
    and says when the unit did not take it, which is how his first try
    will tell. Same switches as the names
    (`OWN_BLOCKS_THROUGH_COMPUTER_FOR_EVERYONE`,
    `OWN_BLOCKS_ON_THE_WEB_FOR_EVERYONE`), both true since 2.0.1 (false until 17 November 2026). Not over Bluetooth
    or a USB cable: the chain EDITOR is not there (the Bluetooth blocks
    read carries no positions). The messages that place a block and join
    a cable are, since 1.90.76, for Quick build (see "The chain over
    Bluetooth", below).
  - *AND THEY HAVE COLOURS IN THE DEFAULT LOOK, since 1.90.73.* "We need
    to build out those block colors because the new ones you added are
    just all gray" (14 November 2026, Play on his Axe-Fx III: DYN, TON,
    NAM, NAM 2, VOC and IRP grey in a row of eleven). Match my unit had
    always had a colour for each, read from Axe-Edit III's own block
    pictures (src/lib/blockPalettes.js `PALETTES.gen3`, which says where
    each came from); the Fractal Remote look, which is the default and
    the one he wears, is the old table kept as it was, and anything it
    never knew was the unknown block's grey. `LEARNED_ON_PLAY` in that
    file gives the five the gen-3 colour there too, one source for both
    looks, by the spelling Play's own names come with (an Axe-Fx II's
    "NAM Player" is still unknown in that look, like every other name
    learned since). HE ASKED FOR "the screenshot I sent that shows all
    the blocks from the quick edit screen off the Axe-edit": IT IS NOT
    IN THIS CONVERSATION (every picture in the record was looked at; the
    only Axe-Edit one is the NAM tile crop of 14 November). The colours
    used are the ones already on file from the editor's pictures. If he
    sends it again, check the five against it and move the gen-3 values,
    which moves both looks.
  - *THE NAM BLOCK HAS ITS OWN PICTURE, since 1.90.72: a small neural
    network in a rainbow.* "Make the NAM block look similar to this. but
    with the same aesthetics that we use in our app now. But like with the
    rainbow type color in that same type of glyph" (14 November 2026, with
    a picture of the block as his editor draws it). It wore the amp's.
    OUR OWN DRAWING, AND IT STAYS SO: scripts/nam-icon.mjs draws both
    files from nothing (a textbook network, three, four and three dots,
    a plain rainbow), test/nam-icon.mjs holds the files to the script dot
    for dot, and the picture he sent is in no commit: the rule about
    artwork from Fractal's editors (above) is why it is made this way.
    Two files in mobile/assets/icons: `nam.png`, white like every other
    block's, and `nam-rainbow.png`, in its own colours with a thin dark
    edge (without it the blue end vanished on the lit purple tile). The
    tile keeps the app's grammar: the fill still says on, the rainbow is
    drawn as it is lit or not, and where a tile is one colour by rule
    (grey when off, the quiet outline) the white one is tinted like every
    other. The phone has no gradient and no SVG, which is why the rainbow
    is baked into a file; a drawing package would have been a build.
    Both ends: `blockIconOwn` (mobile/src/lib/blockIcons.js, and
    src/lib/blockIcons.js with `pictureWears`), the lists held equal. In
    the browser it is inside the computer app, so it came with a computer
    release. To change the drawing, change the script, run it, and the
    test follows; never drop a picture file in by hand. AN INDEPENDENT
    READ before it went out found three things, all fixed: the violet
    end faded into the lit purple tile at the smallest picture (the dark
    edge is wider and darker now, and under the lines too, which had let
    a fifth of the tile through); the edge's blend was worked out wrong
    where it met the colour; and on an iPhone, a grey tile switched on
    would have shown the old white picture in the system's blue for a
    frame (the two pictures are two image views now, by `key`). The
    script also spells its square roots out, because Math.hypot is only
    promised to be close and the test draws the files again on GitHub.
  - *A value's text is a C string in a 32-byte buffer*: the text, a NUL,
    and old bytes from earlier answers after it. The codec's decodeReply
    trims noughts off the end and wants the rest printable, so every value
    with a unit read "?" on his AX3. The reader takes the bytes up to the
    FIRST NUL (gen3-describe decodeDescribe), on purpose unlike the pinned
    codec, which has the same blind spot. What still is not text is
    printed as it came, never a bare "?".
- **The chain editor through the computer, on his Axe-Fx III: it works,
  NAM blocks included.** "Chain editing and adding a NAM block to empty
  preset works." (15 November 2026, the phone on 1.90.76 through the
  Raspberry Pi 5 on computer app 1.90.63, with his log.) What the log
  shows: two blocks swapped in a row and landed (Cab 1 and NAM 2), Chorus 1
  put into an empty row, NAM 1 (block 206) and NAM 2 (207) each put into
  preset 386 and found there on the read after, the preset saved each
  time, and NAM 1 switched off from Play. docs/ax3-readings.md has the
  lines. Quick build and the starter chains are not in that log (they are
  in the next one, the same day: below).
- **Quick build and starter chains: built 15 November 2026 (1.90.76),
  OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then).** "Let's also look into building out a way to build a
  preset quickly from an empty preset. Maybe a "quick build" to build what
  blocks go in them (including NAM blocks) and a quick default starter
  chain option as well with settings a user where A user can create their
  own custom starter chains with what blocks they want in their starter
  chain." Then, of the four pictures (in the session's scratchpad, not the
  repository): "The four screens are good. I need everything with the
  chain builder to work over Bluetooth also" (15 November 2026).
  - *What an independent read found before it went out, all fixed, each
    with a test seen to fail without its fix (15 November 2026).* THE UNDO
    LEFT A PRESET SILENT: the usual empty preset is an Input, a row of bare
    wires joined end to end, and an Output; the build sends its cables over
    those joins, and the Undo cut every cable the build had sent. It now
    cuts only the cables the build ADDED, gives each cell its bare wire
    back, and joins the preset's own cables again (`plan.prior`,
    `undoSteps`), and its read back asks after the wiring too
    (`undoUnjoined`). A PRESET CHANGED BY A FOOTSWITCH PART-WAY got the
    rest of the build. THE UNIT ITSELF IS ASKED WHICH PRESET IT IS ON
    BEFORE EVERY STEP (rig `unitOnPreset`: same, moved, or unknown), and
    nothing else is gone by: the preset on the screen stands still while
    the chain is written, and the news does not always come (through a
    computer a preset changed at the unit is a scene, or nothing; over
    Bluetooth a gen-3 unit says nothing of its own footswitch). Moved, or
    a unit that will not say, and the run stops; the number the steps are
    held to is taken BEFORE the chain is read; and the words say whether a
    run was stopped, never began, or had finished (`PRESET_MOVED`,
    `PRESET_MOVED_BEFORE`, `PRESET_MOVED_AFTER`, `UNIT_QUIET`), with nothing
    read back as this preset's once the unit is on another. A first cut
    asked only when preset news had come in, which a second read showed
    never comes through a computer. An Undo is not run over a block swapped into one of
    its cells since (`undoStale`, read fresh first). A block the unit
    refused in the middle of the row is said as a row with no sound; a
    missing Input or Output has its own words, never the CPU sentence;
    "0 blocks" is never said. A preset with its Input and Output on
    different rows says so in place of a greyed-out picker
    (`buildBlocked`). A list of blocks that could not be read says the
    unit did not answer, with Try again, never "This unit has no Drive…".
    Chains made in Settings with no unit linked go to the first unit that
    links (`adoptStarters`); they were kept and never seen again. Save the
    preset only ever ARMS the save (`saveTo.arm`). Where the app has no
    Save on the connection the sheet says to save on the unit. No words
    name Edit chain, which is not there over Bluetooth.
  - *And a second read, of those fixes, found more, fixed the same way.*
    "Connected" was still said over a row whose Output the unit had refused
    (its cell was a bare wire, fed from the row): `joinBreak` now wants the
    Input and the Output to BE there. Where a chain read shows no wiring at
    all (an older computer app), the Undo cut every cable in the row: it
    cuts none now (`wiringKnown`) and says it left them. Out of a six-row
    unit's top row the app can make half the cables, and the Undo left all
    of them out. "Nothing was added" stood over an Input the app had added.
    A count nobody confirmed ("Took the 5 blocks back out" after a read
    that never came) is not said. Couch-made chains were moved on the rig's
    unit name alone, which the demo leaves behind and a VP4 sets too: they
    move only when Quick build has just read a real unit's blocks. THE
    LESSON AGAIN: the fix for "a preset change slips through" had its own
    way for one to slip through. And a third read, of THOSE fixes, found
    the edges of the new "will not say" answer: a -1 on the screen (a unit
    gone quiet) taken for another preset; "after the build was sent" said
    of a run that had stopped; a result card, "the chain has been read
    again" and all, for a build of which nothing was sent or read; a chain
    read on a new connection, before the wire knew the unit's preset, with
    nothing for its closing question to be compared with; and the live
    read's proof settled by a read that straddled two presets.
  - *What it is.* On a preset with nothing in it but its Input and Output,
    Edit shows Quick build and the starter chains in place of "This preset
    is empty." (components/QuickBuild), and Play one Quick build button
    under its empty-chain line, which opens Edit with the sheet up. The
    player taps blocks in order (NAM and the III's other own blocks are in
    the list, through lib/ownBlocks `ownInPalette`), the app reads the grid
    fresh, refuses if the preset is no longer bare, places them in one row
    (the Input's row, else the second) and joins them from the Input to
    the Output, reads the chain back and says what landed, with one Undo
    and Save the preset. WHAT THE CARD SAYS IS WHAT THE READ BACK SHOWS,
    never what was sent: "Built and connected" only where every cell from
    the one after the Input's to the Output's is fed from that row
    (`joinBreak`); otherwise "Built, but not joined all the way", with the
    column where the signal stops. A read back that failed is said as not
    read (`NOT_READ`, and `UNDO_NOT_READ` for an Undo), never as an empty
    chain or as everything taken back out. A starter chain is such an order, named and kept
    on the device, one drawer per unit (`fractal.starterChains`); "Classic
    rig" (drive, amp, cab, delay, reverb) comes with the app and can stop
    being the default but never be changed. Settings → My rig → Starter
    chains makes, renames, orders (Move up / Move down) and removes them,
    with no unit linked if need be (the unit's list as last read, else
    every family by name).
  - *The rules, the words and the plan are one file*, shared/starter-chains.mjs
    (the phone's copy generated). NOTHING UNDER src/ IMPORTS IT YET: the
    browser's half is a later change and a computer release. The plan is
    split-chain's own steps (every place, then a cable out of each column
    up to the one before the last, never out of the last), run by
    `runPlan`, and its Undo is the exact inverse, taken back only as far as
    a stopped run got.
  - *The switch* is `QUICK_BUILD_FOR_EVERYONE` in features.js, true since 2.0.1 (false until 17 November 2026)
    (lib/useQuickBuild). Where it is drawn is lib/quickBuild
    `quickBuildHere`: never a VP4, only where the unit's capabilities say
    `gridEdit === true`, and only on this preset's own chain. It opens to
    everyone when he says so, with its What's new line then.
  - *THE COMPUTER NEVER SENT `gridEdit`.* ForgeFX's drivers carry it, but
    the capabilities it serves are a curated subset that leaves it out, so
    the phone says it itself from what is there (lib/chainShape
    `withGridEdit`, asked in lib/device `detect`): `gridRouting` (the
    gen-3 units) or a linear unit of FOUR slots that is not a VP4 (the
    AM4); the demo every unit but its VP4. NOT an Axe-Fx II (its driver
    places blocks and lays no cables, so a row could not be joined: a no
    until the plan can build a grid row with no cables) and NOT an Axe-Fx
    Standard or Ultra (linear, 48 slots, no placing at all). A wire that
    says `gridEdit` itself is believed as it is.
  - *OVER BLUETOOTH IT IS THE SAME SCREENS.* They reach the unit through
    five calls of lib/device and nothing else (blockCatalog, gridCells,
    placeBlock, clearCell, setCable) and never ask which wire is under
    them (a test holds both). The Bluetooth wire answers those four routes
    and says `gridEdit: true` for his account since the same change ("The
    chain over Bluetooth", below), so Quick build opens there too, and on
    the unit's USB cable into the phone.
  - *AN AM4'S CHAIN READ COUNTED FROM ONE ON THE PHONE, AND IS PUT BACK TO
    ZERO SINCE 1.90.76, FOR EVERY ACCOUNT* (lib/chainShape `chainFromZero`,
    in lib/device `presetBlocks`, as the browser has done since September;
    the one part of this change a customer sees, and its What's new line). ForgeFX's
    am4.ts placedBlocks answers slots 1 to 4 and the Bluetooth wire the
    same, so through the computer the phone's chain editor called slot 1
    "slot 2", and taking out the block in the first slot cleared the
    second. Not the demo, whose AM4 counts from zero. ITS ROW IS PUT TO
    ZERO TOO: both answer `row: 1`, a linear unit's one row is row 0, and
    left at 1 the chain editor drew a second, empty lane over a full AM4,
    where an Add went over the block already in that slot. The browser's
    zeroBasedChain moves the column only: check it for the same lane the
    next time the browser's chain editor is opened (a computer release).
  - *HIS FIRST TWO BUILDS, 15 NOVEMBER 2026: EVERY BLOCK IN, AND THE
    SECOND KNOWN TO BE NOT JOINED.* "I'm confused by the built but not
    joined? Can't build an auto joined rig? Or make sure the user selects
    what's needed to build a playable starter rig?" His Axe-Fx III through
    the Raspberry Pi (computer app 1.90.63): two empty presets (388, then
    389), the app put an Input, the picks and an Output on ROW 2 and sent
    the cables, every message was taken, and BOTH were read back with
    every block in ("6 in, 0 not", "4 in, 0 not": that line is only
    written from a read back). 389's showed the first cable not there, by
    the card he saw (whether the others took, it did not say). Whether
    388's row read as joined is NOT KNOWN: the log line did not yet say,
    and its card is not in the log. One row seen not joined, then, not
    two. The player had nothing more to
    pick: the app adds the Input and Output and joins the row itself. THE
    MESSAGE THAT JOINS TWO CELLS WAS WRONG for a six-row unit's row 2
    ("The chain over Bluetooth", below, has the whole of it;
    docs/ax3-readings.md has his log and the bytes). Since 1.90.82:
    - *A six-row chain goes on the THIRD row* where the preset has no
      Input or Output to say (`homeRow` in shared/starter-chains.mjs; an
      FM3 keeps the second, and a preset that has an end keeps its row).
      Along rows 3 and 4 the old message and the corrected one are the
      same bytes, so that row does not depend on which computer app is
      sending. HIS AXE-FX III HAS JOINED IT THREE TIMES, 16 November 2026:
      from the phone over a WIDI Master (report 913f344a, "6 in, 0 not;
      connected"), and through his Raspberry Pi on computer app 1.90.63,
      older than 1.90.82 and so sending the law's bytes, which are the
      corrected ones along this row (report adc7d553, "9 in, 0 not;
      connected", every column "fed from row 3"), and through the Pi on
      1.90.63 again (his capture log: 4 blocks, "6 in, 0 not; connected
      from the input to the output", 4.4 s from the tap). Those two bear
      out why the row was chosen. And a fourth time, 17 November 2026,
      through the Pi now on computer app 1.90.90, the first build through
      one that sends the corrected bytes (the same along this row): a
      preset he had emptied in the chain editor (seven Removes, each read
      back empty), 4 blocks, "6 in, 0 not; connected from the input to
      the output", 3.7 s from the tap, and the log's row names NAM 1.
      Not seen on an FM3 or FM9, or on any other row. Do not move it back
      to row 2 while computer apps older than 1.90.82 are about.
    - *The log says the whole row as the unit read it back*
      (`rowAsRead`: "row 3 as read: column 1 Input 1, column 2 Drive 1
      (fed from row 3), …") and whether it read as connected. The card
      says only where the row FIRST stops, and his log could not tell one
      cable lost from three. READ THAT LINE FIRST in his next log. Since
      1.91.8 it names the III's own blocks as the phone does (lib/ownBlocks
      `ownCellName`, handed in as `nameOf`): through the computer the grid
      read called NAM 1 "eid_206" (16 November 2026). Log only; the card
      and what is sent are as they were.
    - The card's words are as they were. Preset 389 was saved unjoined
      (and 388's build was never saved): no sound path, build again on
      another empty preset.
  - *STILL NOT PROVEN ON A UNIT:* a row other than row 3 that reads back
    joined (row 3 has, three times, on his Axe-Fx III: over Bluetooth and twice through
    the Pi, above); the Undo; on a six-row unit with the Input on the top
    row it builds there but lays no cables (that row's cable from an even column
    is still refused) and says so; and whether the unit keeps a bare
    wire's joins under a block placed over it is not known, so the plan
    joins every cell it places into again.
  - *WHILE IT BUILDS, A CARD THAT MOVES (1.91.4).* "Looks like everything
    worked. We need better feedback. Let him know the chain is building
    correctly, like a spinning circle or dots that are moving or
    something, as sometimes it feels like it's just frozen" (report
    913f344a: 56 seconds from the tap to the card, 51 of them the two
    whole-preset reads under one line of text that did not move). In the
    sheet's head, which never scrolls: three steps (Check the preset is
    empty, Put in the blocks and join them, Check what landed; an Undo's
    are Check nothing has changed, Take the blocks back out, Check what is
    left), React Native's own turning circle on the one going (no package,
    so no build), a tick on each done, a bar on each whole-preset read
    counted from the frames the wire keeps against the size known for the
    unit (gen3-grid `DUMP_CHUNKS`, `dumpBytes`; held at 99% until the foot
    has come), and a count of the steps sent. The words and the rules are
    shared/starter-chains `buildPanel`. The picker is hidden and kept, so
    no chip is tapped mid-build and More… is still open after one that
    failed; the ✕ is faded (Sheet `locked`, false everywhere else). Where
    the preset is read down a Bluetooth adapter from a gen-3 unit
    (lib/bleSwitch `gridReadTakesLong`: never an AM4, the unit's USB
    cable or the computer) it says "Over Bluetooth this takes about half a
    minute to a minute." before the tap and under the card, and "Keep the
    app open until it's done.": switched away, the phone stops the app,
    the read gives up part-way and the build fails. Through the computer
    it is the same card with no read bars (its read tells nothing, and
    the word never leaves the phone: lib/device `gridCells`). The unit is
    named from the rig's `deviceName`, never the capabilities, which carry
    no name. Nothing was made faster: both reads are needed (the wire
    refuses a write before a read, and the card says only what the read
    back shows) and the live read is not believed.
  - *The browser's Starter chain* (src/components/GridEditor.jsx, every
    account, its fixed five) is another piece of code, with its own row
    rule since 1.90.82 (`starterRow`): on a six-row unit, the row the
    preset's own Input is on, else its Output's, and the third where it
    has neither; on every other unit row index 1, wherever the ends are,
    as it always was. An independent read found the first cut of it sent
    every six-row preset that HAD an end to row index 1, so a preset with
    its ends on the third row (which Quick build and this button now
    make) got a second Input and Output beside them. IT STILL DOES NOT
    READ THE ROW BACK: it says "Built a starter chain" on the unit's
    not refusing, so through a computer app older than 1.90.82, on a
    six-row preset whose ends are on row 2, it reports a row built that
    is not joined, as it always has. Two more things it does not mend: a
    six-row preset with its ends on the TOP row is built there, where
    every other cable is refused (it says how many, afterwards), and one
    with its Input and Output on DIFFERENT rows is built on the Input's
    with an Output asked for there too, where the phone's Quick build
    refuses in words.
  - *Next:* the browser's half of Quick build, and the chain EDITOR over
    Bluetooth.
  - *A preset whose scenes have no names is not asked for them again,
    since 17 November 2026, for every account.* His log that day (his AX3
    through the Raspberry Pi) had five "GET /store/config/scene-names-…
    failed — not found" lines for every unnamed preset: the computer files
    a preset's scene names only when one exists. The two asks at the
    preset change stay; the follow-ups at 4, 9 and 18 seconds (rig.js
    `followComputerNames`, for an AM4 whose names the computer files a few
    seconds after its own read) are not made once the unit's own read of
    that preset has said every scene is blank (`unnamedAt`). Where no read
    answered (a stale copy, an AM4's failed read, an older computer app)
    the follow runs as before, and a test holds it. And a "not found" from
    the computer's store is no longer logged as a failure (relay.js, as the
    browser already did); every other failure still is. Nothing on screen
    changes. Seen on the bench only: his next log is the check.
- **Saving over Bluetooth is built, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then), since 1.90.52 (13
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
    true since 2.0.1 (false until 17 November 2026). lib/bluetooth `saveOverBluetooth()` (his account, or the
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
    (IT OPENED ON 17 NOVEMBER 2026, in 2.0.1, by the switch, on 2.0.0 copies
    only: *Everything that was his account's is open*, above, says why a switch was
    enough that day.)
  - Bluetooth → What Bluetooth can't do (lib/editWords, screens/Bluetooth
    `DIFFERENT`) still says, for everybody: no moving, adding or removing
    blocks (true for every account but his since 1.90.76: "The chain over
    Bluetooth", below), no modifiers, renaming or copying a channel, a cab chosen with
    the computer on the three gen-3 units, and no looper, volume button,
    unit metronome click or Footswitches page (his account has the volume
    button on an FM3, FM9 or Axe-Fx III since 16 November 2026, and the
    line drops it for him there: "The Output block's levels", below). Keep
    that page true whenever one of these is built.
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
- **What made knobs not take over Bluetooth, and the rules since (16
  November 2026).** His logs showed four faults, all fixed with a test seen
  to fail without each fix:
  - *A block's read was cut in the wrong place.* His Axe-Fx III sent a NAM
    block as four channels of 27 values where the list says 18; 18 divides
    108, so the app took six channels of 18 and read every channel but A
    from the middle of another (Bass showed 8, Bright Cap 10 pF, and every
    knob on B or D "didn't take"). A block has four channels at most. A
    read is cut by the block's own channel count where its list says it
    (`channels` in lib/axefx3-own-knobs.js, from docs/ax3-readings.md),
    else by the stride only where that makes four or fewer, else in four
    (gen3-edit `sliceOf`); the log's read line says the count, the stride
    and where the channel starts. ForgeFX cuts the same way since 426fc0c
    (gen3.ts #channelSlice, ownBlocks.ts `channels`, the same counts as the
    phone's, held equal by test/run.mjs), pinned in 1.90.87, so a NAM block
    read through the computer or the Raspberry Pi has the same channels
    once the computer app has taken that release. Not seen on a unit
    through the computer yet.
  - *The backup write broke settings.* When a knob's check did not read
    back as asked, the app sent it again as a typed write of its 0-to-1
    place, and a gen-3 unit takes a typed write in the setting's OWN
    units: Look-Ahead Time went to its maximum and Bit Reduce to nought on
    his FM3, after a check that had read nothing at all. Now a check that
    heard nothing sends nothing more and Edit says "Couldn't check that …
    took: the unit didn't answer. It may have." (device.js `unverified`,
    the browser's rule; with nothing read after it either, the asked value
    stands on the knob, which had jumped back to the old number and then
    sent nothing when turned back there), and EVERY GEN-3 KNOB IS ONE WAY ONLY: its place
    (52 00), never the typed way (gen3-edit; asked for, the wire answers
    `{ok: false, unsent: true}` and nothing goes). THROUGH THE COMPUTER TOO,
    since 1.90.87: on a unit whose driver lays cables (`gridRouting`: the
    FM3, FM9 and Axe-Fx III) the phone (device.js `oneWayKnobs`) and the
    browser (forgefx.js setParamConfirmed) send a knob its place alone,
    whatever encoding was remembered for it, and a miss the check heard is
    answered with what the unit holds, never a second write. ForgeFX's
    setParam still sends the typed 0-to-1 place when asked `continuous:
    false` (an older app asks it), and setEnum's typed ordinals are right
    and stay; an AM4 and an Axe-Fx II keep the second way.
  - *Whole numbers were drawn as knobs.* What the codec lists as a whole
    number (forgefx-midi FM3_FAMILY_JOIN_DISCRETE, FM9_ROUNDTRIP_DISCRETE,
    III_ROUNDTRIP_DISCRETE: Bit Reduce, Number of Taps, a cab's Type) is
    marked by scripts/gen3-knobs.mjs (a 1 in a seventh place, its range cut
    to what the list allows), read as the number itself and written as that
    number, typed, the codec's own frame; the way out passes only a whole
    number in range there. Bit Reduce at 10 read 0.004 before. Through the
    computer it still does: ForgeFX does not read those lists. ITS RANGE IS
    THE UNIT'S OWN, never the list's figure (the most one sweep read back):
    a cab's Type, the IR's number in its bank, is 0 to 1023, and a first cut
    drawn to the list's 188 (15 on an FM9) could neither show nor reach a
    Factory cab past it (an independent read, before it went out).
  - *Slower than it had to be.* Edit's read of a block gives up 1 s after
    it went if nothing came back (it waited 2.5 s and held the line; a
    healthy read is 0.3 to 0.7 s), and bytes that are not its answer (the
    unit's tempo beat with Send Realtime Sysex on, the phone's own message
    come back) do not stretch that second (they put it on the 2.5 s gap,
    and a beat every half second ran it to its 10 s cap); once a frame of
    the answer has come, its bytes keep it waiting as before (and a beat
    still starts the gap again then, as on every long answer, and the grid's
    preset read has no first wait of its own: both are left as they were). A read with fewer values than its head
    said is damaged, and a channel switch drops the 400 ms list of what is
    in the preset, so the next read is on the new channel. Two checks of
    one block asked together still make two reads.
- **Edit's knobs follow the unit: built 16 November 2026, HIS ACCOUNT
  ONLY.** "Changing a parameter on the unit itself doesn't reflect on the
  Amp" (a customer's FM9 over Bluetooth through a WIDI Master): Edit read a
  block once as its panel opened. Now, on an FM3, FM9 or Axe-Fx III (never
  an AM4, never a VP4, never the demo), the open block's knobs in Edit, the
  hold pop-up and the big screen's panel are read again (the rules are
  mobile/src/lib/liveKnobs.js, the panel's side lib/liveKnobsHere.js, run
  by test/live-knobs.mjs): every few seconds over Bluetooth or the unit's
  cable (the larger of 4 s and five times the last read after it ends; 12 s
  after two minutes with no touch; 15 s once the unit has sent its own
  report on that connection), only when nothing else is waiting for the
  line or on it, and never while a finger is on a knob, a value waits to
  go, a write is out or for 2.5 s after its check, for 3 s after a Play
  tap, a scene or a preset, with the tuner open, a capture going or the
  app away; at once as the app comes back to the front and as a panel
  opens (never from the five-second copy); when the unit sends its own
  block report (the 0x74 burst, bleWire heardReport, which nothing heard
  before); and through a computer when the computer app passes on a knob
  it saw move ('param', which the phone threw away; rig `onKnobNews`). A
  read changes only knobs whose value differs, never one still waiting to
  go, and nothing from a read sent before a write began. The switch is
  `LIVE_KNOBS_FOR_EVERYONE` in features.js, true since 2.0.1 (false until 17 November 2026) (lib/useLiveKnobs for
  the screens, lib/bluetooth `liveKnobsOverBluetooth` for the wire);
  closed, Edit reads and sends exactly what it did. THE UNIT'S REPORT IS
  WRITTEN IN THE LOG FOR EVERY ACCOUNT ("the unit reported a change to
  block 58 (Amp): …, Gain 1 5 → 6.2 on channel A"), and nothing is sent for
  it, so a customer's log says whether their unit sends one: its first
  line in full, the rest folded into a count every 30 s where the knobs do
  not follow (`REPORT_QUIET_SAY_MS`; every second where they do). An
  independent read before it went out found four more things, each fixed
  with a test seen to fail without its fix: the late answer to the app's
  OWN read of a block (given up after its 1 s) was taken as the unit's
  report, which would have said an FM3 sends one, and slowed the reads to
  every 15 s for the connection (a head within the read's late window is
  that answer now, said once); a value set down that sends nothing (a knob
  pushed past its end, a level typed past it, a write that failed) held
  every read for as long as the panel stayed open (Edit `settledAt`);
  through the computer, a read the computer could not finish (every knob at
  nought, no ranges, no model: ForgeFX gen3 blockParams' catch) blanked the
  panel, and is not used now; and a read already out when a finger landed
  was laid over the knob under it (dropped, and a news or front read owed
  again for after the finger lifts). A SECOND READ, of those fixes, found
  three more, fixed the same way: the late window caught the unit's real
  reports on any block for two seconds after any read gave up (it is the
  given-up block's own now, and taken once: `lateReads`); the first
  damaged report of a connection took the log's one line for 30 s, so a
  log could say only "came damaged" over twenty whole reports (it is said
  on its own now); and where the knobs follow, a write the unit took and
  checked jumped back to the old number when the read after it failed
  (the checked value stands, and is let go of). A THIRD READ, after the
  work was carried onto that day's main (17 November 2026), found the carry-over
  word for word and one cost, LEFT: a read the panel's clock sends holds
  the line like any read of a block, so a Play tap that lands just after
  one has started waits for it, up to the read's own time (0.3 to 0.7 s on
  his units; about 0.9 s on a link as slow as 2,000 bytes a second). The
  tap is still sent: its 1.5 s limit is passed only on a link slower than
  any measured, and there the panel's own read on opening does the same
  without this. The clock keeps the line busy a sixth of the time at
  most. Look at it again before the switch opens to everyone (give the
  clock's read up for a tap, or stand it back while Play is beside Edit).
  NOT PROVEN ON
  A UNIT: whether an FM9 or an Axe-Fx III sends that report out of its MIDI
  jacks to an adapter (seen only with an editor on USB; READ THAT LINE
  FIRST in the next log with Edit open while a knob is turned on the unit),
  and whether a block read every five seconds or so is heard as a glitch on
  any of the three (the computer app's every-few-seconds reads of all an
  AM4's blocks were, which is why the AM4 is left out). The browser and the
  computer's window do not follow yet: that is a computer release.
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

**The chain over Bluetooth: a block placed, a cable joined, the grid read.
Built 15 November 2026, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then). Run from a phone once, 16
November 2026: one Quick build on his Axe-Fx III over a WIDI Master, on row
3 (report 913f344a, below under NOT PROVEN); nothing else of it yet.**

> "The four screens are good. I need everything with the chain builder to
> work over Bluetooth also" (15 November 2026, of Quick build and the
> starter chains, above)

Until then the chain could only be changed through the computer: the phone
had no message that places a block, and its Bluetooth read of the chain
(the status read) carries no positions. Since 1.90.76 the wire answers the
computer app's own four routes over Bluetooth, or the unit's USB cable into
the phone, for his account (bleWire `chainOn`): GET /blocks, GET
/preset/grid, PUT /preset/grid/cell and POST /preset/grid/cable. Anything
that changes the chain through lib/device's `blockCatalog`, `gridCells`,
`placeBlock`, `clearCell` and `setCable` therefore works on either
connection with no code of its own for Bluetooth; `caps.gridEdit` says
whether it may (the computer app's own word, true over Bluetooth only
where the chain is open).

- **What is sent is the computer's own, byte for byte.** On an FM3, FM9 or
  Axe-Fx III, mobile/src/lib/gen3-grid.js: "select the cell" (01 30 00)
  then "put the block in it" (01 32 00, block id 0 empties it), and a
  cable into the next column (01 35 00, joined or parted). On an AM4,
  mobile/src/lib/am4-chain.js: the block's code written to one of its four
  slots. scripts/grid-frames.mjs walks every cell, a spread of block ids
  and every cable WHOSE BYTES ARE THE CODEC'S through the PINNED codec and
  writes the digests (test/gen3-grid-codec.json); test/gen3-grid.mjs walks
  the phone's builders the same way and holds them to it. A NEW CODEC PIN
  MEANS RUNNING THAT SCRIPT ON IT, as the knob tables' scripts.
- **WHERE A SIX-ROW CABLE GOES IS NOT THE CODEC'S, SINCE 1.90.82: THE
  CODEC'S WAS WRONG.** The last three bytes of a cable say which two
  cells. On an FM3 the codec's rule, which FM3-Edit's own messages bear
  out, is the two cells' numbers packed seven bits to a byte. For six rows
  (FM9, Axe-Fx III) the codec has a fitted "law" instead, and it is that
  packing only for a cable into row 3 or 4, or out of an odd column into
  row 1, 5 or 6 (270 of the 432 it builds on a unit). For the other 162
  its bytes name ANOTHER CELL: into row 2 from any column, row 6 of the
  source's own column; out of an even column into row 1, row 3 of the
  source's own column; out of an even column into row 5 or 6, row 1 or 2
  of the next column. His Quick build of 15 November sent three of those
  along row 2, and the read back showed the row not joined at its first
  cable. The codec's notes hold no recording for any of the 162, and two
  of its row-2 examples are an FM3's bytes.
  - *So a six-row cable is the packing at both ends*: the computer app
    builds it itself (ForgeFX 07bc01a, server/src/gridCable.ts, over the
    codec's own frame, so the codec still says what is a cable at all),
    and the phone's Bluetooth builder is the same (`cableWhere`). The two
    are held to the same three frames by each side's own test, and
    scripts/grid-frames.mjs stops if a later codec builds the packing
    itself (then both can go back to the codec's bytes). gridCable.ts AND
    gen3-grid.js ARE CHANGED TOGETHER.
  - *NOT SEEN ON A UNIT in the 162 that changed.* The packing is an
    inference (the FM3's proven rule, every six-row case the law gets
    right, the row that failed), not a recording. Three independent reads
    found nothing against it and no other cause for his unjoined row. A
    MIDI Monitor recording of Axe-Edit III drawing one cable into row 2
    would settle it; so will a row-2 build read back.
  - *AN OLDER COMPUTER APP STILL SENDS THE LAW'S BYTES*, for every
    customer feature that joins cells on an FM9 or an Axe-Fx III (the rows
    editor, the looper at the end, putting a block back, the browser's
    Starter chain): another cell named for a cable into row 2 (row 6 of
    the source's own column), out of an even column into row 1 (row 3 of
    the source's own column), and out of an even column into row 5 or 6 a
    real cable into the wrong row (row 1 or 2 of the next column).
    `cableAsTheLaw` (gen3-grid.js; nothing in the app asks it yet) says
    for which cables such a computer's bytes name the cells asked for.
    Nothing tells a player to update for it, and COMPUTER_NEEDED did not
    move: Quick build goes where the two sets of bytes are the same WHEN
    THE PRESET HAS NO INPUT OR OUTPUT of its own. A preset whose ends are
    on row 2 (389 as he saved it is one), or on row 5 or 6, is built on
    that row with whatever bytes the computer app sends, so through one
    older than 1.90.82 it is not joined (every cable along row 2; the
    cables out of even columns along rows 5 and 6). If a
    customer reports a silent row on an FM9 or a III, the computer app's
    version is the first thing to ask.
- **Every frame is held at the way out to the one job in hand** (gen3Sender
  `gridShaped`/`gridAllowed`, am4Sender `am4SlotAllowed`): a frame of the
  grid's shapes goes only if it is, byte for byte, one the wire is sending
  for the grid at that moment, and never for an account the chain is not
  open to. An AM4's slot write is held to four slots and the seventeen
  blocks it names itself, or nought: never a fifth slot (one address
  further answered wrongly on a real AM4 and disturbed another slot), and
  never a second copy of a block. The AM4's own notes said placing blocks
  was "deliberately NOT here, ever, over Bluetooth"; this is that, opened
  on his word, as tightly as anything it is sent.
- **One cable is still refused: out of a six-row grid's TOP row from an
  even column** (FM9, Axe-Fx III). The codec calls it "not decoded" and
  refuses to build it, the computer app still goes by that, and so does
  the phone (`cableKnown`), in words. It is very likely just the packing
  (out of an even column the law is wrong into four of the six rows, so
  recordings of those cables could not have been made to fit it), and
  the rows editor looks for a free row for a parallel path from the top
  row down (`freeRowFor`), so on a six-row unit its paths are the ones
  that meet this refusal. OPEN IT, at both ends and in Quick build's
  `top` and `unmakeable` rules together, once a row-2 build has been seen
  to join; not before.
- **An FM3 is held to its own twelve columns**, which the codec is not (it
  lets an FM3 ask for columns 13 and 14).
- **A refusal is answered, not thrown** ({ok: false, refused}), as the
  computer answers one, so a plan of several steps goes on (a unit with no
  room for the fifth block still gets four joined up) and whoever asked
  reads the chain back. An AM4 answers a slot write with nothing, so the
  wire reads the preset back and the slot itself says.
- **A write asked before a scene or preset change is never sent after it**
  (`movedSince`, and `moved()` drops the ones waiting), and grid jobs go
  one at a time (`inGrid`).
- **A write is taken only for the chain as it was last read** (bleWire
  `chainSeen`): the grid has to have been read since the last scene or
  preset change, or a place or a cable is refused with nothing sent. A
  plan is many requests, each its own, and a footswitch can step the unit
  to another preset between any two; without this the rest of a build
  went into that preset. And the block is asked about again between its
  two messages (select, then put), and an AM4's slots read back after a
  move are not taken as the write's answer. A CHAIN READ ENDS BY ASKING
  THE UNIT WHICH PRESET IT IS ON (`gen3StillHere`): a gen-3 unit stepped
  on while its preset was being read says nothing, and the clock that
  would have asked is held off while the line is busy, so the read is
  refused if the unit has moved or will not say. An AM4's answer names its
  own preset, and that is heeded (`am4SlotsNow`). A wire is new with each
  connection, and a write before any read says that, not that the preset
  changed.
- **TWO WAYS TO READ THE GRID, AND THE FAST ONE IS NOT BELIEVED YET.** The
  preset whole (the edit buffer, the read the computer app uses, proven on
  all three units through a computer) is 24,680 bytes from an FM3 or FM9
  and 49,336 from an Axe-Fx III, a moment on a USB cable. Down an adapter
  on the MIDI jacks the jack's own pace would make that eight seconds and
  sixteen; MEASURED on his Axe-Fx III through a WIDI Master (report
  913f344a, 16 November 2026) it took 25.0 s and 25.9 s, about 2,000 bytes
  a second, so a Quick build there spends about 50 of its 56 seconds on
  its two reads. Whether the adapter or the unit set that pace the log
  cannot say, and an FM3's or FM9's has not been timed over an adapter.
  EVERY GRID THE APP ACTS ON IS THAT ONE. The live read (01 2E 00, one answer of 755 bytes) is taken
  beside it and laid against it in the log, and nothing more, until a
  unit's log has shown what it says: its layout is the codec's reading of
  two recordings, an Axe-Fx III's has never been captured, and the rule it
  would be believed by (gen3-grid `gridProof`, kept and tested behind the
  wire's `liveGrid`, which nothing in the app hands it) can be satisfied
  by one chain on one row. gen3-grid's own comment lists what that rule
  needs before it is switched on. So a build over an adapter on the MIDI
  jacks reads the whole preset before and after: slow, and the unit's own
  answer. The log has the live answer itself once a connection (written
  BEFORE the preset is asked for, so it is there even from a unit that
  does not send its preset down that wire) and what the two agreed on,
  with the preset's own grid beside it ("the live grid read agrees with
  the preset: … (the preset has: r2c1 37, …)", or "DISAGREES … at row r,
  column c"): READ THOSE LINES FIRST in his first log from each unit.
- **The switch** is `CHAIN_OVER_BLUETOOTH_FOR_EVERYONE` in features.js,
  true since 2.0.1 (false until 17 November 2026) (lib/bluetooth `chainOverBluetooth`, handed to the wire as
  `chain`, which also wants Edit open). OPENING IT TO CUSTOMERS IS A STORE
  VERSION, not the switch alone, as Edit and saving over Bluetooth: every
  copy out was reviewed with notes that say blocks are not moved, added
  or removed over Bluetooth, and Bluetooth → What Bluetooth can't do
  still says so to everybody (true for every account but his until then).
  (It opened on 17 November 2026, in 2.0.1, by the switch, on 2.0.0 copies
  only, and that page says Quick build now: *Everything that was his
  account's is open*, above.)
- **SEEN ON A UNIT ONCE, AND NO MORE (report 913f344a, 16 November
  2026).** "Looks like everything worked." His first Quick build over
  Bluetooth, his Axe-Fx III through a WIDI Master, on empty preset 390:
  the phone placed six blocks on row 3 (Input 1, Drive 1, Amp 1, Cab 1,
  Chorus 1, Output 1) and joined the five cables along it, and the read
  back said "6 in, 0 not; connected" (every column after the Input "fed
  from row 3"). So a block placed from the phone over Bluetooth, cables
  joined from the phone along ROW 3, and the whole-preset read over an
  adapter (the unit does send its edit buffer down its MIDI jack when
  asked: 25.0 s and 25.9 s for 49,336 bytes) are no longer NOT PROVEN:
  on an AXE-FX III ONLY, through THAT ADAPTER ONLY, on THAT ROW ONLY.
- **NOT PROVEN ON ANY UNIT:** anything of the above on another row, on an
  FM3, an FM9 or an AM4, or through another adapter (or how long the
  read takes on them); a cell emptied or a cable parted from the phone (no
  Undo has run over Bluetooth); the live read (in that log its blocks
  agreed with the preset's and its cables did not); slot 1's address on an
  AM4 from here; whether a cable into an EMPTY cell makes the unit carry
  the signal across it (the browser's Starter chain has always assumed
  so; every cell of his row held a block). His AM4 and FM3 are the next checks,
  each one's first build. (Through the COMPUTER his Axe-Fx III has taken
  blocks from Quick build and from the chain editor, 15 November 2026; of
  the cables sent along its row 2 that day, the first was not there on
  the read back, above.)
- **Not built:** the chain EDITOR (move, add or remove one block) over
  Bluetooth. It draws from the blocks read, which over Bluetooth still
  has no positions; Edit still says so there (BLE_NO_CHAIN). The grid
  read it needs exists now.

**Play's and Edit's blocks in the unit's own order over Bluetooth: built
16 November 2026, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then).** A customer (an FM9 through a WIDI
Master, an iPhone): "the order of the Effects doesn't correspond to the
real order of the FM9". Over Bluetooth or the unit's USB cable the one
block read is the status read, in effect-id order with no positions, and
Play and Edit drew outlineChain's usual-order guess; through the computer
they come column by column off the grid. Now, on an FM3, FM9 or Axe-Fx
III, after Play's status read the wire asks the grid's live read (01 2E
00) ONCE per preset and block list on a connection, and uses it to ORDER
the list and nothing else (bleWire `gridOrder`): column by column, top row
first, the computer's walk. No row or column is handed on, so no other
screen sees anything new. It is believed only where its blocks are
exactly the status read's (NOT_BLOCKS left out of both: a III lists 200
and 201 in every status answer), no preset changed between the two reads,
and the unit, asked after the grid's answer, says it is still on that
preset; within `ORDER_QUIET_MS` of a preset change it waits out the rest
of that time first (a rig that sends Program Changes back), and it is not
asked before the unit has said which preset it is on. No answer, a
refusal, one it cannot read or other blocks: the usual order and a line
saying why; two reads in a row with nothing usable and it is not asked
again that connection. A scene change
or a preset seen again asks nothing; a chain changed from the phone is
read again. Never an AM4 (its slots come in order) or a VP4. The way out
lets that one frame through, byte for byte, only while the order is open
to the account at that moment (`orderHand`, `orderOr`); the grid's writes
and the preset whole stay the chain's. The switch is
`BLOCK_ORDER_FROM_GRID_FOR_EVERYONE` in features.js, true since 2.0.1 (false until 17 November 2026) (lib/bluetooth
`blockOrderFromGrid`, handed to the wire as `blockOrder`, not behind
Edit's door); every other account gets today's order and today's bytes,
which a test holds. READ "block order from the unit's grid, preset n: …"
or "the grid's blocks don't match the status read: …" FIRST in his next
log from each unit, beside "the grid's answer for the block order, as it
came" (once a connection). NOT PROVEN ON A UNIT: an FM3, FM9 or Axe-Fx III
answering the live read down its MIDI jack through an adapter (every
answer on record came over USB to a computer), how long it takes there,
and what an Axe-Fx III's answer looks like (never captured; read as an
FM9's, and the check against the status read is what keeps a wrong
reading off the screen). Not known either: a block moved on the unit's
own front panel with the same blocks in the preset keeps the old order
until the next connection. It opens to everyone when his log shows it
agreeing, with its line in What's new then.

*What an independent read found before it went out, all fixed, each with
a test seen to fail without its fix (16 November 2026).* A block moved
from the phone and not saved stayed where Play drew it after the unit had
dropped the move (another preset and back, the same one chosen again, the
footswitch away and back): now the next preset change lets go of what was
kept, and the stored layout is read again. A footswitch step while the
grid was being read went unnoticed, so one preset could be drawn in the
next one's order: the unit is now asked which preset it is on after the
grid answers (one small read more, once a preset), and a step it finds is
news, so Play reads the new preset. An answer that came after its read had
given up could be taken by the next preset's read: for two seconds after a
read comes back with nothing the grid is not asked (the usual order that
once, Play not kept waiting). A read straight after a preset change gave
up, and the rig's own preset read comes just before Play's, so a preset
could stay in the usual order for good: it now waits out the rest of the
0.4 s and asks. A grid that never agrees with the status read is given up
on after two in a row, as the rule always said. And the log says "the
connection went while the grid read … was out" where it used to say the
read was not sent. THE LESSON AGAIN: a footswitch says nothing, so a read
kept for a preset asks the unit where it is at the end, as the chain's
read does.

*And a second read, of those fixes, found two more, fixed the same way (16
November 2026).* Edit's own live grid read is the same question, byte for
byte, as the order's, and its answer can come after it has given up: a
footswitch step meanwhile, and the next preset was drawn in the last one's
order and kept for the connection. Now an Edit read that gives up opens
the same two-second window as one of the order's (bleWire gen3LiveGrid,
`gridLateUntil`). And a "which preset?" question that went unanswered
(Play's own, or the watch's) held the order's closing question for the
rest of its late window, and Play's tiles with it, up to two seconds: in
that window the grid is not asked (the usual order that once, no miss).

*And a third read, of THOSE fixes, found the rest of the same two (16
November 2026), fixed the same way.* The window went one way only: Edit's
own live grid read did not wait out the ORDER's late window, so on the
next preset it could take the order's late answer for its own, which as
the app ships says DISAGREES and turns the live read off for the
connection, and with the live read believed would hand Edit the last
preset's layout. Now Edit reads the preset whole inside that window (bleWire
gen3Grid; judged when Edit asked, which the fourth read found was not
enough, below). And the check for a missed "which preset?" ran once, before
the grid read: a question already on the line then (Play's own, the
watch's, or a stored slot's name from Presets beside Play) kept the grid
read waiting behind it and went unanswered just before it left, so its
late window was open by the time the grid answered, and the closing
question was held again. It is looked at again before the closing
question, and both checks skip only where more of the window is left than
ORDER_QUIET_MS, so a moment left of it no longer loses the order for the
whole visit. That did NOT close the hold for a question put on the line
WHILE the grid read was out (the fourth read, below). The tests were
tightened for Edit's window (its length, to about 90 ms, and none opened
by a read answered in time) and for the FIRST check's skip (not a miss,
not kept); the order's own window, the second check's skip and where the
ORDER_QUIET_MS line falls were not held until the fourth read.

*And a fourth read, of THOSE fixes, found the hold still open one exchange
later, and the tests still looser than they said (16 November 2026), all
fixed, each test seen to fail with its fix taken out.* A "which preset?"
kind of question put on the line WHILE the grid read was out (the Presets
list beside Play naming a stored slot, Play's own preset read) went out
the moment the grid answered, before the order could look, so neither
check saw a window; with its answer lost, the closing question waited
behind it and then through its whole late window, and Play's tiles with
it, about three and a half seconds. Looking for windows cannot see that
one, so the closing question itself now has a deadline, `ORDER_CLOSE_MS`
(ORDER_QUIET_MS and 50 ms, so a hold the checks let through goes before
it): not sent by then, the usual order that once, no miss, nothing kept,
the grid asked again at the next read once that question's window has
passed, with its own line in the log. The
cost is that a question ahead of it that is slow but does answer loses
the order for that one read. (As built it fired on the player's own taps
too: the fifth read, below.) Edit's live grid read is judged when its
turn comes, not when Edit asked for it (`unless` in the send queue,
gen3LiveGrid `held`): it waited in line behind Play, the order's
read could give up meanwhile, and it then left inside that read's window,
took its late answer, and left its own answer unguarded for the next
preset's order read to take, so a preset was drawn in the last one's
order and kept. The log says when the connection went while the closing
question was out, or the adapter would not take it (both were said as the
unit not answering), and a skip names
whose read left the window open, Edit's or the order's (`gridLateBy`; it
blamed the order's read for Edit's). The tests were then said to hold
where the ORDER_QUIET_MS line falls at both checks (about 370 and 300 ms
left: asked and believed; 440 left at the first: not asked; 540 left at
the second: not closed), the second check's skip (not a miss, not kept),
the order's own window and Edit's to within a few milliseconds of their
end, and Edit's skip near the end of the order's window, as shipped and
with the live read believed; and a question ahead of the closing one was
said to cost Play's tiles ORDER_CLOSE_MS at most. The fifth read found
three of those looser than said (the second check's line held only
between about 300 and 540 ms, Edit's window from below only, the order's
half of `gridLateBy` not at all) and the grid read's own wait behind such
a question not bounded at all (below).

*And a fifth read, of THOSE fixes, found the deadline given too widely and
the hold still open one exchange EARLIER (16 November 2026), all fixed,
each fix and each tightened test seen to fail with it taken out.* The
closing question's deadline fired on the player's own taps too: taps go
ahead of Play's reads, a scene whose answer is lost holds the line half a
second and four block taps as long, so a healthy unit lost the order for
the visit and the log blamed "another question" for the tap. Now the
deadline is given only where a question of its own kind (a "which
preset?", function 0x0D: Play's own, the watch's, a stored slot's name)
is on the line, or waiting ahead at Play's read priority or above, when
it is asked (bleWire `presetAhead`), so "(another question was ahead of
it)" is said only then; anything else ahead is waited for, as before the
fourth read. And the grid read itself waited behind such a question: the
status answer starts one waiting the moment it lands, before the order
looks, so with its answer lost the grid read waited a second and a half,
and the check after the grid's answer then threw the order away, Play's
tiles 1.6 to 3 s for nothing (two tests that said "does not hold Play's
tiles" allowed two seconds). The grid read now has the same deadline on
the same condition: dropped, it is the usual order that once with its own
line ("the grid could not be read for the block order in time …"), no
miss, nothing kept, and asked again once that question's window has
passed. The cost is the one already taken: a question ahead that answers,
but slower than ORDER_CLOSE_MS, loses the order for that read. The log
says "the connection went before the unit could be asked" where the
closing question never left. The one way still to the second check is a
"which preset?" that goes ahead of the grid read AFTER the order looked:
only a save's own question does (asked at a write's place in the line),
and with its answer lost it holds the grid read a second and a half, and
the closing question waits without a deadline (a fifth-read gap, left:
his account, a save made during Play's read, its answer lost; the same as
before the fourth read). The tests now hold a tap ahead of the grid read
and of the closing question waited for, the grid read's drop (a question
on the line, one still waiting its turn, a stored name, one lost from the
Presets list beside Play), the deadline's value at both places (a question
ahead answered about 400 ms after it went is waited for, about 480 not),
the second check's line from both sides through a save's question (about
380 ms left: believed; 420: not closed) and its skip twice (no miss,
nothing kept), the order's half of `gridLateBy`, an Edit read held back
never counted as unanswered, Edit's window from above too (to a few
milliseconds), and two refusals of the closing question at the way out
counted as no miss. What a lost "which preset?" ahead costs Play's tiles
now is ORDER_CLOSE_MS at the grid read or at the closing question (at
both only where a second one goes on the line while the grid is read),
except behind a save's question.

*And a sixth read, of THOSE fixes, found the deadline still spent on the
player's taps (16 November 2026), fixed, each fix and test seen to fail
with it taken out.* The deadline counted the whole line, and taps go ahead
of every read: with a "which preset?" in the line that DOES answer (Play's
own, or the Presets list beside Play naming slots, which always has one
out), four block taps or a scene whose answer is lost used it up before
that question had even gone, so a healthy unit lost the order for the
visit, at the grid read as well as at the closing question. Now it gives
up only on a "which preset?" on the line that has gone unanswered for
ORDER_CLOSE_MS from when IT went (bleWire `presetHolds`, handed to the
send queue as `stillFor`); taps, scene and tempo reads, a read held for a
late answer to its own kind, and a "which preset?" that answers in time
are all waited for. A drop is still the usual order that once, no miss,
nothing kept and no late window opened. The tests now also hold the
priority half of `presetAhead` (a save's question waiting at a write's
place gives the deadline, the watch's on the line gives it, Edit's waiting
behind Play's reads does not) and a dropped grid read leaving the next
visit free to ask. Left, as the fifth read said: a save's own question
that goes ahead AFTER the order looked gets no deadline, so with its
answer lost Play's tiles wait about one and a half to four seconds; and a
lost question of another kind ahead costs its own wait (about 0.7 s for a
scene or tempo read), with the order kept.

**The computer's tools over Bluetooth: started 18 November 2026 (2.0.5),
OPEN TO EVERY ACCOUNT THE SAME DAY, AND NONE OF IT HAS BEEN SEEN ON A UNIT.**

> "I want to enable all of the items currently available to computer bridge
> users to Bluetooth like chain editing and live tuner on phone and Apple
> Watch." (18 November 2026)

What the computer did and Bluetooth (or the unit's USB cable into the
phone) did not, that day: the chain editor, modifiers, Rename, Copy
channel, a cab picked on a gen-3 unit, the looper, the unit's own metronome
click, the Footswitches page, an AM4's volume button, and a tuner on an FM9
or Axe-Fx III that needs nothing set on the unit. Brought over in passes.
Each piece has its own switch in mobile/src/lib/features.js, false, so it
is his account's until he says, as every new thing is, and it is new for
customers: a copy's review notes have to describe it, or it is keyed to a
store version (the rule under *Everything that was his account's is open*).
The watch is the phone's: whatever the phone can do with the unit, the
watch's pages do through it, and nothing here needed the watch's own code.

HE OPENED THE FIRST PASS TO EVERYONE THE DAY IT WAS BUILT: "Open it up to
everyone" (18 November 2026, before the pull request had merged and before
any of it had run on a unit). So the three switches below are TRUE since
2.0.5, with three lines in What's new, on 2.0.0 copies (the only copies
main's updates reach). The 2.0.0 review notes as written on 17 November do
not describe them; whether Apple's 2.0.0 had been sent for review by then
was not known, and he was asked. If one has to be shut again, its switch
goes back to false in an update: tell him first. The next pass's pieces
(below) were his account first, and opened in 2.0.8.

THE FIRST PASS, three switches:

- **The tuner asks the unit** (`TUNER_ASKS_FOR_EVERYONE`; bleWire `asksOn`,
  gen3TunerOn; the wire's `tunerAsks`). The tuner was already there over
  Bluetooth on the phone and the watch. But on an FM9 or an Axe-Fx III it
  sent Fractal's switch alone, whose readings come only with Send Realtime
  Sysex on at the unit (off as a unit comes), where the computer app opens
  the tuner page and asks for the frequency on every gen-3 unit (ForgeFX
  registryCore #setTuner, #pollTuner) and needs no setting. Open: a switch
  that brings no reading in 1.2 s is followed by those two messages, which
  this wire already sent an FM3, and the next open on that connection goes
  straight to them (`pushQuiet`). Close sends the switch off and the page
  closed, each only if it went. Closed, the switch alone, as before; an FM3
  and an AM4 are untouched. The same bytes the computer sends over USB;
  never seen down a MIDI jack on those two units.
- **The chain editor** (`CHAIN_EDITOR_OVER_BLUETOOTH_FOR_EVERYONE`, which
  also wants `CHAIN_OVER_BLUETOOTH_FOR_EVERYONE`; the wire's `chainEditor`,
  capabilities `chainEditor`). The editor is the one Edit always had: it
  reaches a unit through lib/device and never asks which wire is under it,
  and the messages that place a block and join a cable went out with Quick
  build. What it lacked was every block's place.
  - *The read.* While the editor is open (Edit's `chainOnWire`, lib/device
    `wantPlacedChain`), the chain is asked for with `{ editing, placed }`
    and the wire answers it as the computer answers GET /preset/blocks
    (bleWire `gen3PlacedBlocks`): the grid's cells less its bare wires, each
    with its row, column and `fromRows`, and its on and off and channel
    from the status read. THE PLACES ARE THE PRESET READ WHOLE, never the
    live read, so it is as slow as that read: half a minute from an Axe-Fx
    III over a WIDI Master, after every change. The editor says so
    (components/ChainReading, lib/chainOnWire: a turning circle, how far
    the read has got, "about half a minute to a minute"). A moment on the
    unit's USB cable. An AM4's own read has its slots already and is not
    touched.
  - *Kept fifteen seconds* (`PLACED_FRESH_MS`, the computer's own figure
    for its copy), only for a read that asks (`placed`, or `kept` on GET
    /preset/grid, which lib/device sends only with the editor open), and
    let go of at any write to the chain and any scene or preset change.
    Every other grid read is the moment's copy, as before (a mutant that
    kept it for everybody fails two tests).
  - *Drawn only from a chain with every block's place*
    (lib/chainOnWire `placedReady`): until the read lands the editor's
    place holds the reading line, or The chain couldn't be read with Try
    again. A block drawn in the wrong space is a block written over.
  - *The looper* comes in that read marked `noControls`, so its cell is
    held and Play draws no looper tile for it (its buttons are not sent
    over Bluetooth yet). The looper-at-the-end button is not drawn there.
    Modifiers do not ride in with the editor (`modsHere` wants a computer).
  - A whole drag was run through shared/chain-move's own plan against the
    wire and a pretend FM3 and Axe-Fx III (test/bluetooth.mjs): the blocks
    land, the row is joined again, and nothing but the grid's own messages
    went. ON A UNIT, NOTHING: his first Add, Remove and drag are the check,
    on each of the AM4, the FM3 and the Axe-Fx III. Row 2, 5 and 6 cables
    on a six-row unit are still the packing nobody has seen join.
- **Rename, and Copy channel** (`EDIT_TOOLS_OVER_BLUETOOTH_FOR_EVERYONE`;
  the wire's `editTools`, capabilities `namesWritable` and `channelCopy`).
  Rename preset and scenes is the computer's own two messages into the
  edit buffer (mobile/src/lib/bleNames.js, held to the pinned codec's
  frames: on a gen-3 unit function 0x01, 28 00 for the preset and 2B 00
  for a scene; on an AM4 action 0x0C at CE 01, the preset's with the
  location the AM4 has just said it is on). The codec calls the gen-3 pair
  decoded from Axe-Edit III and hardware-unverified; the computer app has
  sent them to customers' units since rename was built. A name is cleaned
  as the computer cleans it (printable ASCII, 32 places). The way out
  passes a name only as the one being written, byte for byte; a refusal is
  THROWN, because the rename screen believes a write it is not told failed;
  a name asked before a scene or preset change is never sent after it.
  Copy channel is un-hidden where the wire says so: it is reads and writes
  Edit already made there. Copy a scene onto another, under Rename, is
  Play's own messages.
- **The words** follow what is here (lib/editWords `noChainLine`,
  `editingLine`, `limitsLine`, each handed `{ editor, tools }`): with
  neither, word for word as every customer reads them.

WHAT AN INDEPENDENT READ FOUND before it went out, all fixed, each with a
test (test/bluetooth.mjs, under "WHAT AN INDEPENDENT READ FOUND"):

- *An Add in the editor was refused for good after a scene change, and on
  an AM4 always.* The wire takes a place or a cable only for the chain as
  read since the last scene or preset change (`chainSeen`); the editor's
  Add, written for the computer, reads no grid first, and an AM4's chain
  read is not its grid read. lib/device `chainReadFirst` reads the grid
  before a place or a cable where the wire says it has not been read
  (`chainRead()`), only over the wire with the editor open.
- *A name could land on the wrong preset.* A gen-3 name frame names no
  preset, and a footswitch step says nothing: the unit is now asked which
  preset it is on before every name, as a save asks (`nameHere`); on
  another, the move is counted and nothing is sent; one that will not say
  is sent nothing. An AM4 the same, by its location.
- *The editor's read could pair one preset's places with another's on and
  off* (a grid kept up to fifteen seconds, then a footswitch). The unit is
  asked which preset it is on after the status read, every time, and every
  block the status read lists has to be on the grid, or nothing is drawn
  and the copy is let go of. A block on the grid the status read does not
  list is still handed on, its on and off not known (an FM9 may not list
  its Input and Output).
- *Two names asked together refused each other* at the way out: one at a
  time now (`inNames`).
- *"The chain couldn't be read" flashed up* while the read with the places
  was still out, when a read without them was already on its way: waited
  through (Edit `readPlaced`, twice at most). And the editor never draws
  from places left on the chain by an earlier visit (`placedRead`).
- *The chain kept its places, and a looper nobody can drive, after the
  editor closed*: Play's own read is made again as it closes.
- *The tuner fell back to asking with the switch picked by hand* in the
  testing tools: Auto's alone now.

It ruled out the one that mattered most: no message the wire sent before
has a name's shape (gen-3 subs in use are none of 28 or 2B; an AM4's
writes at CE 01 are never action 0C), so the new guard refuses nothing
that went before. THE PRETEND AM4 IN THE TESTS FREEZES ON ANY MESSAGE NOT
ON ITS LIST, as the real one once did; the name message was added to what
it knows, with the eighteen-byte answer the codec has from AM4-Edit.

THE SECOND PASS, 2.0.6, THE SAME DAY, FIVE SWITCHES, ALL TRUE SINCE 2.0.8
(every account). "Yes the 2.0 version Apple app is already in review. Let's
get the rest of the computer only items implemented for over Bluetooth." (18
November 2026.) So everything that was still the computer's is built for an
FM3, FM9 and Axe-Fx III, and NONE OF IT HAS BEEN SEEN ON A UNIT. It was his
account's for two releases, because Apple's 2.0.0 was in review. Then, the
same day: "Apple approved the 2.0.0", and "Enable the 5 new Bluetooth items
to all accounts, not just mine". So the five went to true in 2.0.8, with two
lines in What's new, on 2.0.0 copies (the only copies main's updates reach).
The 2.0.0 review notes do not describe them; the review was over. If one has
to be shut again, its switch goes back to false in an update: tell him
first. When a report comes in about any of the five, it has never run on a
unit: read the log first.

- **The looper's buttons** (`LOOPER_OVER_BLUETOOTH_FOR_EVERYONE`; lib/bleTools,
  bleWire gen3LooperButton and gen3LooperTelemetry; the wire's `looper`,
  capabilities `looper`). Open, the wire hands the Looper block on in Play's
  chain (it left it out: `OFF_STAGE`), so Play draws its looper pedal and
  the panel works as through the computer. Each button is the computer's
  one message (function 0x01, 10 00, the block, the button's setting, 1.0
  or 0.0), to a block the catalog calls a looper and one of its eight
  buttons only; never sent twice. The panel's read is the playhead each
  time (23 bytes) and the loop's picture (some 600 bytes) no more than once
  in six seconds, both at the lowest place in the line: with anything else
  waiting, nothing is asked and the last picture stands. The looper's level
  is not asked for (the panel does not draw it). The chain editor's read
  marks the looper `noControls` only while this is closed.
- **The unit's own metronome click** (`UNIT_CLICK_OVER_BLUETOOTH_FOR_EVERYONE`;
  bleWire gen3WriteClick and gen3ReadClick; the wire's `unitClick`). The
  Metronome switch at the unit's Global block (block 1), its number the
  unit's own from shared/metronome.mjs, written typed 1 or 0 as the
  computer writes it, and read back (1A 00) for the metronome's own follow.
  NOTHING ELSE AT BLOCK 1 IS EVER WRITTEN FROM HERE: any other number is
  refused before a frame is built. shared/metronome.mjs is untouched (it is
  inside the computer app). What changed is what its `bluetooth` flag is
  handed: every place that asked "is this Bluetooth?" for the click
  (MetronomeSwitch, Settings → Metronome, lib/metronome useUnitCan, App's
  useUnitMetronome) asks lib/bluetooth `useBluetoothNoClick` now: Bluetooth
  AND the click not switchable over it. Closed, that is `useBluetoothOn`
  exactly. Never an AM4.
- **Modifiers** (`MODIFIERS_OVER_BLUETOOTH_FOR_EVERYONE`; bleWire
  gen3BindModifier and gen3RawSlot; the wire's `modifiers`, capabilities
  `modifiers.overWire`, which is what Edit's `modsHere` reads over the
  wire). GET /mod/model is ForgeFX's own answer; a slot's stored numbers
  are the slot's block (3 to 34) read whole; an attach is the computer's
  three typed writes on the slot's block (the target block, the target
  control, the source), refused for a slot past the 32nd and never sent
  after a scene or preset change. AS THROUGH THE COMPUTER, ONLY AN FM3
  LISTS ITS SOURCES: an FM9's and an Axe-Fx III's are not known to the
  engine, and the panel says so. Edit's requests for these say they are
  Edit's (lib/device `EDITING`), and want Edit's door open.
- **A cab picked by name** (`CAB_PICKER_OVER_BLUETOOTH_FOR_EVERYONE`; bleWire
  gen3CabState; the wire's `cabs`, capabilities `cabIrs`). The cab state is
  ForgeFX's cabState line for line, out of the block's own read (kept from
  Edit's read of the block just before, so nothing more is asked of the
  unit); the IR names are the engine's lists (about 100 KB in the app; a
  player's own User IRs show as numbers, as at the computer); a cab's model
  list is the engine's own for the unit (an FM3's 45 DynaCabs; empty for an
  FM9 and an Axe-Fx III there too). The picks are Edit's own typed writes,
  which the way out already took. ONE NEW ROAD: an IR's number written
  typed as the number itself (`continuous: false`), which Edit's rule
  answers "not sent" for a whole-number setting; with the picker open the
  wire builds the same typed frame the rule builds from a place.
- **The Footswitches page** (`FOOTSWITCHES_OVER_BLUETOOTH_FOR_EVERYONE`;
  bleWire gen3FcState, gen3FcCurrent, gen3FcNames; the wire's
  `footswitches`). AN FM3 ONLY, the one unit whose switches the engine
  reads live. Reads only, each one question (function 0x01, 1B 00, block
  199 and a setting) answered with one number; some thirty to a switch, so
  a view of three is a few seconds over an adapter. Nothing is ever written
  to block 199, from here or at the computer.
- **The tables are the engine's own, generated** by scripts/gen3-tools.mjs
  into mobile/src/lib/gen3-tools.js: it bundles ForgeFX's devices.ts and
  gen3.ts as they are (esbuild) and RUNS them, so the modifier model, the
  footswitch model, the cab picker's settings and lists and the IR names
  are the driver's own answers, re-derived nowhere. A NEW PIN OF EITHER
  MEANS RUNNING IT (`node scripts/gen3-tools.mjs <forgefx> <forgefx-midi,
  built>`); a test holds the commits in the file to desktop/forgefx.lock.json.
- **AND THE PHONE IS HELD TO THE ENGINE'S OWN DRIVER.** The same script runs
  that driver against a pretend unit with fixed contents and writes every
  message it sent and every answer it gave to test/gen3-tools-engine.json.
  test/bluetooth.mjs puts the same contents in its own pretend unit, makes
  the same calls of the wire (a cab's state, a slot read, an attach, and on
  an FM3 a footswitch, the layout and view on now, the layout names), and
  fails on a message or an answer that differs, on all three units. The
  looper's and the click's frames are held to the codec's by hex.
- **The way out** (gen3Sender, `tooling`, `looperAt`, `setupAt`; lib/bleTools
  `toolShaped`): a looper button (10 00), a looper's picture (23 00), a
  range read (1A 00), a footswitch read (1B 00), a monitor read at a looper
  (19 00; the tuner's own is the same read at block 35 and is not held), and
  any write, typed or a knob's, at block 1, a modifier's slot or block 199,
  goes only as, byte for byte, the one message in hand. A modifier's slot
  read whole is one of Edit's shapes and passes only as the one in hand.
  "A capture is coming" is a typed write at block 1 too, and is asked about
  first (namShaped), as before.
- **A reading of nought is the question's own bytes** (the read has noughts
  where the answer has its value), which the echo guard drops as the
  phone's own message come back: each of these reads says what that means
  (`same`), as the blocks' question does.
- **The words** follow what is here: Bluetooth → What Bluetooth can't do's
  last line names only what is still missing (lib/editWords
  `notOverBluetoothLine(volume, here)`; null where nothing is), its line
  about choosing a cab with the computer is left out where the picker is
  here, and `noChainLine`, `editingLine` and `limitsLine` take `mods`. With
  none of the five, every sentence is word for word what it was.
- **What an independent read found before it went out, fixed, each with a
  test.** A looper press waited behind the panel's own reads and lost its
  tap deadline (it was sent a third of a second late): a press has its own
  turn on the line and its own hand at the way out now, with the deadline
  taken before request() lets go of it. One lane held a whole page of
  footswitch questions (a hundred and more), so the metronome's switch
  asked meanwhile went seconds late: the lane is taken a question at a
  time. And the click's read back no longer takes its own bytes for an
  answer of nought (an echo would have read as "off"). It found no frame
  the wire sent before that the new guard refuses. LEFT, AS AT THE
  COMPUTER: a scene changed between an attach's three writes leaves it
  part-written, and the 32 slot reads are not stopped by a preset change
  (the panel's own `stillHere` is). NOT HELD BY A TEST: the wire's own
  `setupAt` wiring (no route can build such a frame to try it with).
- **AN AM4'S VOLUME WAS NEVER THE COMPUTER'S.** The first pass's list had it.
  Through the computer an AM4 lists no Output block either (ForgeFX am4.ts),
  so it has no volume button on any connection. Nothing to bring over.
- **Not brought over, and why:** the engine's meters, CPU and block monitors
  (no screen of the phone draws them); the looper-at-the-end button in the
  chain editor (hidden over the wire); a player's own User IR names (the
  engine cannot read them either). A VP4 gets none of it: its wire sends no
  SysEx.

**NAM on an AM4: asked for 18 November 2026. Named and switched on Play
over Bluetooth, with TONE3000 and the Capture button on a held block. OPEN
TO EVERY ACCOUNT SINCE 2.1.3 (18 November 2026; his account's from 2.0.9).
Its knobs, and all of it through the computer, are not built.**

> "It works. Go ahead and put it out to everybody.." (18 November 2026,
> with his log: an AM4 on the 3.00 beta through a WIDI Jack, an iPhone,
> app 2.1.2)

- *OPEN SINCE 2.1.3, and what his log showed first.* `AM4_NAM_FOR_EVERYONE`
  is true, with a What's new line. That one switch opens the name and the
  on and off, and, through `captureOn`, the capture tools for an AM4 (the
  TONE3000 door and the Capture button were already everybody's by their
  own switches). The paragraphs below were written while it was his
  account's and say so; read "HIS ACCOUNT ONLY" in them as "until 2.1.3".
  SEEN ON HIS AM4: the block's channel set (block 209); hold NAM,
  TONE3000, a search for an empty slot (two slots answered in 0.4 s, 003
  empty); a capture sent over Bluetooth in 35.4 s, 130 messages, the
  closing one answered in 660 ms, the slot read back by name, KEPT ON THE
  FIRST TRY (name byte 0x60 with the file's hash); NAM 1 pointed at slot
  003 and named back; Get. NOT IN THAT LOG: a pick from the Capture list,
  the block switched off and on at 2.1.2, a second NAM block (0xD2), the
  unit's USB cable, an Android phone. One AM4, one adapter, one capture.
  If it has to be shut again, the switch goes back to false in an update
  and it is his account's that day: tell him first. Google's 2.0.0 review
  was not known to be over when it opened; Apple's was.

> "Fractal just announced NAM support for AM4, so please research that and
> let's get the support built in as well." (18 November 2026, the day Apple
> approved 2.0.0)

- *ITS KNOBS IN EDIT, AND ALL OF IT THROUGH THE COMPUTER: built 18 November
  2026 (2.1.4), OPEN TO EVERY ACCOUNT SINCE 2.1.5 THE SAME DAY ("open them up
  to everyone"; both switches true, one What's new line), and NONE OF IT
  HAD RUN ON A UNIT WHEN IT OPENED. Read "false" and "his account" below as
  "until 2.1.5". If one has to be shut again, its switch goes back to false
  in an update: tell him first. Through a computer it needs computer app
  2.1.4 or later; on an older one the block is the number it was.* "And go
  ahead and build it out for the computer and the raspberry pie and do the
  knobs and edit" (the same day).
  - *The knobs* (mobile/src/lib/am4-own-knobs.js, hand-written as the III's
    own are; the codec's catalog has no NAM): Level (setting 0), Input Gain
    (11), Bass, Mid, Treble (15, 16, 17), Bright (19), and three switches,
    Phase Invert (12), Tone Stack Location (13), Tone Stack Type (14). FROM
    HIS RECORDING: AM4-Edit read those settings of block 0xD1 one at a time
    (action 0x0D), and each answer has the value and the AM4's own words
    ("0.0 dB" at 0.8 of the travel, "0.00 dB" at half, "POST" as 1, "ACTIVE"
    as 0, "5.00" at half). THE NAMES AND RANGES ARE THE AXE-FX III'S NAM
    BLOCK'S, which fit every one of those; the AM4 does not say a name and
    one point does not prove a range. So EVERY READ LOGS THE AM4'S WORDS
    BESIDE THE APP'S NUMBER ("read the nam’s settings one at a time …, as
    the AM4 words them: Level “0.0 dB”, …"), and "THE APP’S RANGE IS WRONG
    for …" where they differ. READ THOSE LINES FIRST in his first log. The
    switches' other choices (INVERT, PRE, OFF, eleven tone stacks) are the
    III's numbering, never seen on an AM4. Left out: 10 (the capture, the
    pick's alone), 3 (the on and off), 18 and 20 (not read by AM4-Edit),
    42 ("8 Band", not understood).
  - *READ ONE SETTING AT A TIME, never whole.* Every other AM4 block is
    read as a register (fn 0x1F). Nobody has seen this block answer that,
    so it is asked AM4-Edit's own question for each setting on the list
    (am4-edit `readEach`, `buildAm4ReadOne`, bleWire `am4EachParams`), and
    the way out refuses the whole-register read of it. Nine short reads;
    the capture it plays is read with them, so Edit draws the Capture
    button over the knobs. A knob is written as every AM4 knob is (its
    place along the travel), a switch as its number; never a setting not
    on the list.
  - *The switch* is `AM4_NAM_EDIT_FOR_EVERYONE` in features.js, false
    (lib/bluetooth `am4NamKnobsOverBluetooth`, the wire's `am4NamKnobs`,
    bleWire `am4KnobsShut`). Shut, the block is what it is for everybody
    since 2.1.3: its on and off and channels, TONE3000 and Capture on a
    hold, and no read or write of Edit's reaches it. With the knobs up the
    hold pop-up has them and TONE3000; the Capture button is then Edit's.
  - *Through the computer or a Raspberry Pi* (ForgeFX 68a7ffb,
    server/src/am4Nam.ts, in the computer release that came with 2.1.4).
    The engine sends the block with NO SLUG (it sent "0xd1"), reads its on
    and off from it, writes its channel, answers its knobs the same one at
    a time, and answers the captures' routes for an AM4, with GET
    /nam/blocks/:eid/slot. The phone names it (lib/ownBlocks `nameAm4Nam`,
    by its two codes, on an AM4 only), `fixed` so the chain editor never
    moves or removes it, `turns` where his account has the knobs. The
    switch is `AM4_NAM_THROUGH_COMPUTER_FOR_EVERYONE`, false. FOR EVERY
    OTHER ACCOUNT, through that computer app, the block is a held "New
    block" (it was a tile called 0xd1). am4Nam.ts AND THE PHONE'S
    am4-nam.js / am4-own-knobs.js ARE CHANGED TOGETHER; each is held to the
    recording's frames by its own test. COMPUTER_NEEDED did not move. His
    Pis take the release by themselves (his account skips the day's wait)
    once nobody has used them for half an hour, or Check for updates.
  - *To open either:* its switch to true and a What's new line, on his
    word, after his log shows the AM4's words agreeing with the app's.
- *What is known* (Fractal's forum, read through search results only: its
  pages and the wiki refuse a cloud session). AM4 firmware 3.00 is in beta
  ("AM4 Firmware V3.00 Beta 4" is pinned in the AM4 forum) and brings a NAM
  Player block. As on the Axe-Fx III it plays NAM A2 captures only, runs on
  the amp's core, and has a Full and a Lite algorithm (Full about six times
  the Lite's load); forum members report two NAM blocks a preset, the second
  dropping to Lite beside an amp on a non-Turbo unit. NOT KNOWN: its release
  notes word for word, how many capture slots an AM4 has, and which AM4-Edit
  loads them.
- *Why nothing is built from that.* An AM4's blocks are known to the phone
  and to the computer app by a fixed list of seventeen codes
  (fractal-sysex `AM4_BLOCKS`; the codec's own tables at the pin), and
  neither has one for NAM. The codes are the gen-3 units' block numbers,
  but the III's NAM is 206, which on an AM4 is where the NAMES are written
  (0xCE), so it cannot simply be assumed. AND AN AM4 FROZE ON A MESSAGE IT
  DID NOT EXPECT: nothing is sent to a guessed address, ever.
- *What an AM4 on 3.00 does in the app today.* A slot holding a block the
  app has no name for is drawn by its number ("0xNN"), with no on and off,
  and is asked nothing (bleWire am4Placed). Everything else is as it was,
  IF firmware 3.00 left the AM4's other messages alone, which nobody here
  has seen.
- *Since 2.0.7 the log says the number*: "blocks this app has no name for
  yet on the AM4, preset A01: slot 2 holds 0xNN (n). Nothing was asked of
  them." (once for each set of them on a connection). THAT LINE, from his
  AM4 on the 3.00 beta with a NAM block in a preset, over Bluetooth, is the
  first thing needed. Through the computer the engine's own log has it.
- *HIS AM4 SAID IT, 18 November 2026: the NAM Player is block 0xD1 (209).*
  His log, an AM4 on the 3.00 beta through a WIDI Jack, app 2.0.8: "blocks
  this app has no name for yet on the AM4, preset Y04: slot 2 holds 0xd1
  (209)". Everything else on that preset answered as before, so 3.00 left
  the AM4's other messages alone there.
- *Since 2.0.9, HIS ACCOUNT ONLY, over Bluetooth or the unit's USB cable:*
  the block is named NAM on Play, with its on and off and its channel read
  and written by the messages every AM4 block gets (lib/fractal-sysex
  `AM4_NEW_BLOCKS`, kept apart from `AM4_BLOCKS` so it is never a block a
  slot is GIVEN and never one Edit has knobs for; `am4Block` says
  `own: true`). The switch is `AM4_NAM_FOR_EVERYONE` in features.js, false
  (lib/bluetooth `am4NamOverBluetooth`, the wire's `am4Nam`, bleWire
  `am4Known`): closed, it is a number asked nothing, as before, and the way
  out (am4Sender `newBlocks`) refuses any frame at that block. Edit opens
  it on its on and off alone (`knobs: false`). A second NAM block is taken
  to be 0xD2. NOTHING HAS BEEN SENT TO THAT BLOCK ON A UNIT: his first
  tap is the check, and if the AM4 freezes, switching it off and on cured
  it before. No TONE3000 door and no capture picker there (those are the
  III's two block ids). Through the computer it is still unnamed: that is
  ForgeFX, a new pin and a computer release.
- *HIS RECORDING OF AM4-EDIT LOADING A CAPTURE CAME THE SAME DAY, AND IT IS
  THE III'S UPLOAD AT MODEL 0x15* (docs/am4-nam.md has all of it; the
  recording is not in the repository). The same record, word for word in
  its layout, and the phone's own `namUploadFrames(0x15, 1, words)`
  rebuilds all 130 recorded messages byte for byte. Round it the AM4
  writes setting 0x5C of block 1 (the III: setting 114). Slots 0 to 127 and one more, asked
  with action 0x45; each 327-byte answer is the III's slot head, packed the
  same way. A block
  is pointed at a slot by writing its setting 10 (the III: setting 0). A
  second NAM block IS 0xD2: AM4-Edit read it.
- *Since 2.1.0 the Bluetooth wire answers the capture tools' four routes
  for an AM4, HIS ACCOUNT ONLY* (GET /nam/empty, GET /nam/heads/a/n, POST
  /nam/slots/n, POST /nam/blocks/id/slot): one piece of code for an Axe-Fx
  III and an AM4, with each unit's own four messages handed in (bleWire
  `NX`; lib/am4-nam.js for the AM4's, held to the recording's own frames by
  test/am4-nam.mjs). Open only where `AM4_NAM_FOR_EVERYONE` or his account
  AND the captures' own gate say so (`captureOn`). Every frame of a capture
  job's shape is held at the AM4's way out to the one job in hand
  (`am4NamShaped`, `am4NamAllowed`), and nothing of them is on the AM4's
  allow-list. The pretend AM4 in the tests answers them only as "firmware
  3.00" (`nam: true`); without it, it freezes on each, as on any message it
  does not know. NOTHING OF IT HAS BEEN SENT TO AN AM4.
- *Since 2.1.1 TONE3000 is on a held AM4 NAM block, HIS ACCOUNT ONLY* (the
  block is only named NAM where `AM4_NAM_FOR_EVERYONE` or his account opens
  it). An AM4's NAM block has no knobs in the app, so its pop-up is its
  channels alone: the TONE3000 button is drawn over them
  (lib/tone3000Quick `doorBlock`: with no knobs up, only an AM4's NAM
  block; an Axe-Fx III's pop-up without knobs is word for word what it
  was), the page takes the channels' place, and Get goes "back to its
  channels". Which unit is told by the block's id alone
  (lib/captureUnit: 206/207 an Axe-Fx III's, 0xD1/0xD2 an AM4's), and
  every sentence of the page is the Axe-Fx III's with the unit's name put
  in at the one place it is drawn (`forUnit`; the page's `u`), so there is
  one set of words. Developer → TONE3000 plays in the linked unit's own NAM
  1 (`firstNamOf`, by the rig's name for the unit). NOT SEEN ON AN AM4:
  the pop-up, a search for an empty slot, a send, a pick.
- *Since 2.1.2 the Capture button is there too, HIS ACCOUNT ONLY*
  (components/HeldCapture): under TONE3000 on a held AM4 NAM block, the
  capture the block is on and the list of the AM4's captures to choose
  from, the Axe-Fx III's own picker (components/CapturePicker). It is in
  the pop-up because the block has no knobs in Edit to sit over. Which
  capture is asked of the unit (the wire's GET /nam/blocks/<id>/slot,
  AM4-Edit's own question, an AM4 only; lib/device `namWhichHere`), when
  the pop-up opens and when the preset, scene or channel moves. The AM4's
  list is its own, 128 slots, kept under `fractal.captures.am4`
  (lib/captureListHere: the unit linked says which list is on show;
  lib/captureList `listed`). A pick marks the preset changed. NOT SEEN ON
  AN AM4, and the picker's sheet opens over the pop-up's sheet, which has
  not been seen on a phone.
- *Then, in order:* the same through the computer (ForgeFX's list, a new
  pin and a computer release);
  its knobs (the AM4's settings are not the III's by number: read off the
  unit, as the III's were, or from a newer codec); the capture list and
  pick; and sending a capture from TONE3000, which needs a recording of
  AM4-Edit loading one (the III's was 130 messages worked out from his
  MIDI Monitor recording; an AM4's upload has never been seen).

TO OPEN ANY OF THESE TO EVERYONE: its switch to true, its What's new line,
Bluetooth → What Bluetooth can't do read again, and the review notes (or a
store version) saying so. NOT WHILE A STORE REVIEW IS UNDER WAY, unless he
says so knowing an update reaches the reviewer's copy: tell him that first.
The first pass's three went out that way on his word, and the second
pass's five in 2.0.8, after Apple had approved 2.0.0.

**In the chain editor, what a tap did is said under the card that was
tapped, and a tap that sends nothing is in the log.**

> "Not sure if it added the block it was trying to add here. No
> confirmation after I clicked add. Check the logs" (15 November 2026, an
> Axe-Fx III through the Raspberry Pi, a row of thirteen blocks)

His log had three taps on a block to add (Wah 1, Drive 1, Formant 1) and
nothing after any of them: nothing had gone to the unit. Add on a card
puts the new block in the first free space AFTER that card in its row, the
row was full from there to its Output, and the editor said "No free space
after…" in its one line over the chain, a dozen cards up and off the
screen, and wrote nothing down. Since 1.90.78 (mobile/src/lib/chainAdd.js,
run by test/chain-add.mjs), for every account:

- Where there is no room after a card, Add shows the words IN THE LIST'S
  PLACE (why, and what to do: remove a block after it, or use Put a block
  in an empty space under the chain), so no block can be tapped that would
  not be added. Where there is room, the line under the list says where
  the block will go: "right after" only when that is the next space.
- What an Add did is said under the card it was tapped on ("✓ Added Wah 1
  at row 3, column 12.", or what the unit did instead), and a block the
  unit would not take out the same way. The line over the chain is still
  written too; it is not where the finger is.
- An Add opened with nowhere to put a block, and a block tapped that was
  not sent, each leave a `[chain]` line that says "not sent".
- AN INDEPENDENT READ before it went out found the words wrong on an AM4:
  "Remove a block first" was said after its last slot, where taking a
  block out makes no room after it. So what to do is worked out, not
  fixed: removing is offered only where a block after the card can be
  removed, and Put a block in an empty space only where the chain has a
  free space (`removableAfter`, `roomAnywhere`). From the same read, not
  defects by its own count and cheap to put right: a block the unit would
  not put in an EMPTY SPACE is said under that space; the tick is for the
  block that was asked for (the cell holds a block AND the unit has that
  block's id there, where the read carries ids), a cell that holds some
  other block is said as that, and a block that was in the chain already
  is said as MOVED, since a unit has one of each.
- A SECOND READ, of those extras, found the tick's own rule wrong twice:
  it asked where the unit had the block and took the first place it
  found, so with a block listed in two places (the demo lists a moved
  block in both) "holds another block. Nothing was added there" was said
  under the new block's own card; and a block moved from its OWN card had
  its line filed under the cell it had just left, where nothing draws it.
  The rule is one function now, `addOutcome` in lib/chainAdd, run whole
  by the test: the cell is asked first; "moved" only where the block is
  gone from where it was; a line for a cell that has become part of a run
  of empty spaces is drawn under that run (`saidInRun`), and a block that
  left its card has its line under it where it is now. THE LESSON AGAIN:
  what was added on top of the fix, unasked, is where the next faults were.

So when a log shows a tap in the chain editor and no `[chain]` line after
it, that is a bug in the editor, not something the unit did. Not built:
making room (moving the blocks after the card along one) when the free
space is further down the row. The browser's editor is another design and
was not looked at for this.

**Moving blocks in the chain editor joins the row again after the move and
checks it, since 1.91.9, for every account, at both ends.** NOT SEEN ON A
UNIT YET: his next drag's log is the first check.

> "Editing the chain, moving compressor after the NAM block caused the
> sound to stop completely." (16 November 2026, his AX3 through the
> Raspberry Pi, computer app 1.90.63)

- *What his log showed.* The drag (Comp 1 from column 2 to after Flanger 1)
  cleared columns 2 to 5 of row 3 and put four blocks back, eight writes
  and not one join, then wrote "landed" four times: the check asked only
  where each block was. On a gen-3 unit a join lives in the cell it FEEDS
  (the rows of the column before), and a block put into a cell joins
  nothing on his unit, so the row most likely read "fed from nothing" from
  column 2 on. Moving Comp back was the same clear and put again. He saved
  it so twice: preset 390 is very likely stored cut. The app said nothing:
  the same read carried every block's feeds, and nobody looked at them.
- *What a drag does now* (shared/chain-move.mjs, one plan for the phone's
  Edit.js and the browser's GridEditor.jsx; the phone's copy is generated).
  The grid is read first (GET /preset/grid, which has the bare wires the
  chain read leaves out; the tests move blocks with a bare wire before
  them, and with one after them) and the joins into and out of every moved
  column kept, each once, cross-row ones too (the tests hold a split and a
  merge). NEVER A JOIN OUT OF AN OUTPUT OR INTO AN INPUT: joins belong to
  the columns, and an Input or Output dragged along the row (or past by
  another block) would otherwise get a cable Fractal's editors never draw.
  A move whose joins could not be made again is refused BEFORE anything is
  cleared, in words under the row: out of a six-row unit's top row from an
  even column, or, through a computer app older than 1.90.82 (or one that
  does not say), a six-row join that computer sends to the wrong cell
  (lib/gen3-grid `cableAsTheLaw`). A join along row 3 or 4 is the same
  bytes either way, so his drag on row 3 goes through his Pi; a move on row
  3 whose blocks also join another row may be refused through it. A move
  refused because the chain on the unit is not the one on screen reads the
  chain again, as its words say: in the browser a plain re-read
  (GridEditor `onReread`, App's read() alone at both of its places), never
  `onChanged`, whose record('grid') writes a history line, hands the
  assistant a hand edit and marks the preset unsaved (Save and Revert over
  a preset nothing was written to). WHERE THE APP MAKES THE JOINS (a gen-3
  unit, the demo's grid units) AND THE SCREEN CAN NAME THE PRESET, the unit
  is asked which preset it is on before every write of the move
  (`presetHold`, Quick build's rig unitOnPreset; the browser's GET
  /preset): a footswitch mid-move stops it there, and nothing more, the old
  row's joins least of all, goes into the other preset. The first clear
  goes on the ask made just before it, unless his account's settings were
  read in between (below), when it is asked again; on another preset then,
  or not saying, nothing is sent and the move is answered as one refused
  before anything ("Nothing was moved: the unit is on another preset now."
  or "…didn’t say which preset it’s on."), with no failure, no history line,
  the Undo kept and nothing marked unsaved (the screens' `starting` is
  called only just before the first write). A move a preset change stops
  part-way keeps its history line in the browser, but does not mark the
  preset the unit stepped to unsaved (App's record `stepped`). An AM4 or Axe-Fx II
  move is not held. What it costs: a customer's four-block drag on his row
  makes 12 preset asks and 3 grid reads besides its 12 writes. Then the
  clear and put as before, the grid read again and THE ROW WRITTEN TO THE
  LOG BEFORE ANYTHING IS MENDED ("move: row 3 straight after the move:
  column 2 Drive 1 (fed from nothing), …"), only the joins now missing
  sent, and the row read again and checked. Still cut, it says so under
  the row ("The blocks moved, but row 3 isn’t joined at column 2, so
  there’s no sound past it.") with Join the row. The row is then asked on
  that last read as a cut row is (`rowCuts`, empty spaces counted, with
  the move's own rows, computer app and chain read), so a cut the plan did
  not cover is said too, with Join the row only where the app can make
  that join: a block brought up from after the Output, whose column
  nothing fed, leaves the Output joined to nothing, and the plan itself
  still joins only the columns it moved. Through a computer app older than
  1.90.82, a join into row 5 that app sends to the wrong cell is said with
  its reason and no button, and so is the top row's out of an even column
  (the tests hold both, and the same row through 1.90.82 offered the
  join). A moved block the unit did not put in its new cell is named, and
  Join the row is never offered a join into or out of a cell the move left
  empty (it could only answer that the cell is empty): between the row's
  Input and Output on the last read as an empty space with no sound past
  it, with no button ("The unit didn’t take NAM 1 at column 3, so row 3
  has an empty space there…"); a moved Output or Input that read has
  nowhere on the row as a row with no sound, with no button ("The unit
  didn’t take Output 1 at column 3, so row 3 has no Output now, and no
  sound. Add it again, or move one back."); past the Output or before the
  Input, where the sound does not stop, as a block no longer in the preset
  ("…so it isn’t in this preset now. Add it again, or move one back."),
  only where that read has it nowhere. The empty space and the row with no
  Output or Input are said alone, with no button; a block gone from the
  preset comes after whatever else the row's read says (its cut, with Join
  the row for the joins that touch no empty cell, first). A write that throws puts the blocks back
  and joins them again the same way, and where the unit has joins to make
  the words (`afterMoveSaid`, `putBackSaid`) say "were put back" only where
  the read after shows every block in its own cell; otherwise they name the
  blocks that are not, or say the app tried and could not read to check. On
  a unit with none (an AM4, an Axe-Fx II) nothing is read back, and the
  browser's history line says "its blocks were put back" when no put-back
  threw. A move refused before anything is sent keeps the Undo of the last
  change. The "landed" line counts columns from one (it counted from
  nought).
- *A row already cut is offered Join the row* whenever the chain editor
  reads the chain (`rowCuts`, the grid read only when the chain read shows
  a block fed from nothing): a block on an Input's row, before its Output,
  fed from NOTHING, is joined from the cell before it on that row. ONLY
  WHERE THE APP CAN JOIN THE WHOLE CUT: a join it cannot make (the top
  row's, an older computer app's, or one into a cell with an empty cell
  before it) is said with its reason and the row gets no button. The one
  exception is where empty spaces are counted (the browser's tap-to-move,
  an Add that moved a block, a move's own ask after, Join the row's
  answer): there a cell after an empty space is said with the space and is
  neither joined nor counted as blocked, so the button is offered for the
  cut cells the app can join, and the space is still said after. Never on
  a row with a parallel path, never on an AM4, VP4 or Axe-Fx II, never
  over Bluetooth (no chain editor there). After it the row is asked again
  (its rows and the computer app's bytes as it was found, and its empty
  spaces ALWAYS counted), and "Row 3 is joined again." is said only of a
  row that reads whole with no empty space between its Input and Output,
  and never of a row that HAD its Input and its Output and reads back
  without one: with one gone (rowCuts skips such a row, so it alone finds
  nothing) the answer is "Row 3 has no Output now, and no sound. Add one,
  or move one back." (or Input), not green, with no button. "Had" is asked
  twice: of the read just before the press, and of the MOVE that left the
  note. A move says whether its row had both before anything was written
  (moveBlocks' `hadEnds`), and every join its note hands to Join the row
  carries that (`had: true`, afterMoveSaid); the screens pass the joins back
  as they are, so neither screen changed. The read before the press alone
  cannot tell: after a move that failed part-way and did not bring the
  Output back, the Output is already gone on it. A parallel branch, or a
  row whose Output is on another row, never had both, and is "joined again"
  when its joins read back. (The sixth round asked every row for both, and
  refused the green on a branch that played; the seventh asked only the
  read before the press, and called a row a failed move had left with no
  Output joined again; the eighth is this.) Only the pressed row is said;
  and never "sent" of joins nothing sent. A
  press that sends nothing (every join already there, the unit on another
  preset or not saying, the read failing, a join into an empty cell) is no
  edit: the phone marks the chain written from joinRow's `starting`, called
  just before the first join, and the browser writes a history line only
  where a join was sent, and otherwise reads the chain again. It
  should mend 390 and any customer's preset cut the same way: NOT YET
  PRESSED ON A UNIT. The browser's tap-to-move and Replace read the rows
  they touched after, and say a row left cut (or with an empty space
  mid-row, which nothing joins across) the same way; an Add of a block
  already in the chain (a unit has one of each, so it moves) reads the row
  it left the same way, at both ends.
- *What is said under a row is the newest truth about it* (`rowNote`): a
  move, an Add (and, for an Add that moves a block, the row it left), a
  Remove or an Undo clears what was said under that row first; Join the
  row replaces its note with its own answer after. A green "joined again"
  gives way to a read that finds the row cut since, a refusal keeps its
  words with the found cut's Join the row under them, and a note about
  another preset is not drawn.
- *Settings are measured, never written back, ON HIS ACCOUNT ONLY.* Before
  and after a move, each moved block is read once (its params read): a NAM
  block's capture slot and one knob of each, in the log only ("move: NAM 1
  after: capture 001, Level 0 (was capture 040, …)"). Nothing on screen
  says whether they were kept. Two reads a block (eight for his four-block
  drag) would slow every drag, so only his account's are measured (the
  phone's kept sign-in, `bluetoothAdmin`; the browser's account, `admin`
  from App.jsx), and the first clear after them asks the preset again (a
  unit on another preset then, or not saying, gets nothing: above).
  Through the computer the capture comes with no name.
- *STILL NOT KNOWN, AND HIS NEXT LOG SETTLES BOTH:* whether his unit keeps
  a join through a clear and a put ("straight after the move" says "fed
  from row 3" for keep, "fed from nothing" for drop; the "move: joins"
  line says how many were missing), and whether a block's settings survive
  being cleared and put back (the before and after lines). Which of the
  unit's messages drops the join (the clear, the select, the put, or the
  next cell's too) is not known either; the plan is written for all of
  them, and the tests hold it on the two below. A MIDI Monitor recording of
  Axe-Edit III dragging one block in a row would settle the true move (its
  own message, or clear and put, and whether it sends joins after). No
  join the move sends has been seen to take on a unit; the along-row-3
  bytes are the ones Quick build's joined there.
- *THE DEMO JOINS EVERY BLOCK IT PLACES*, so no test of a drag against it
  could see this. Both mocks (mobile/src/lib/mockDevice.js and
  src/lib/mockDevice.js) take `createMockDevice(unit, { joinsAsOnUnit:
  true })`, which only the tests pass: a placed block joins nothing and an
  emptied cell takes the join INTO it with it (not the joins out of it into
  the next column). test/chain-move.mjs runs his drag on it. The other
  rule, a clear that also drops the joins OUT of the cell, is a plain grid
  in the test file (`dropsOut`, tests only, never the mocks): his drag, a
  bare wire after the moved blocks, and a split out of the first of two
  moved columns are held on it. The demo itself is unchanged.
- *The screens are not run by the tests.* What they hand the plan is
  pinned by patterns on the calls (moveBlocks' and joinRow's arguments),
  not whole. The preset hold is pinned whole at both ends, and the phone's
  is also built from the screen's own text and run against a stubbed rig. What they read and draw for a cut row is pinned WHOLE, token
  for token, in test/chain-move.mjs (the flattened code, comments out): the
  cut-row read (its busy and stop guards included), RowCut on each screen
  (its words, `canJoin` before the button, the button sending the joins
  with their row, `disabled`), the place each draws RowCut, the browser's
  read after a write (`checkRows`, every row it touched) and the phone's
  read of the row a block left (`sayRowLeft`); Join the row's guard by its
  first line. The third round's pins were first lines only, and the
  review's one-token switch-offs next to them passed every test. In the
  fourth round (16 November 2026) the review's 25 mutants (SP10 to SP19,
  SB7 to SB16 on the screens; L5c, L7, L8, L8b and L9 on the after-move
  and Join the row reads' arguments) and 24 of that round's own (the
  measured stop, the browser's re-read, the not-taken words, What's new,
  the watch pictures' retry) were each run against the tests: all 49
  failed them. In the fifth round (17 November 2026) its 23 mutants (the
  empty-cell joins, the moved Output or Input, the two halves of
  "between", the phone's hold, Join the row's `starting` at both ends, the
  browser's part-way stop, What's new) each failed them too. In the sixth
  round (17 November 2026) its 5 mutants (a moved Output or Input the unit
  did not take offered Join the row again, and Join the row's end check
  taken out, never set, asking only for the Output, or asking the read
  before the press) each failed them too. In the seventh (the same day) its
  8 mutants, each in each copy of the library (the sixth round's rule put
  back, the end check never set, not heeded, asking only for the Output,
  asking the read before the press, asking that read whether the row had
  both ends, taking any row with cells for one that had, and the button
  back beside a refused Output) each failed them too. In the eighth (the
  same day) its 20, each in each copy (the note not marking its joins, or
  marking every row's; Join the row not heeding the mark, or heeding it
  alone; a move saying every row, or no row, had both ends, or asking the
  read after the move; the seventh round's eight again; the button beside
  a refused end heeding only the Output, or only the Input; another row's
  Input taken for this row's) each failed them too. The ninth is tests
  only, for two slips the eighth's review found nothing would catch: a
  row whose Input and Output only the chain read names (asked without the
  chain read's words, by the move or by the press, the same failed move
  was "joined again"), and a move with no joins to keep, which has no grid
  read to ask (without its guard every AM4 and Axe-Fx II move threw after
  its writes); its 5 mutants in each copy each failed them. A change to a
  pinned piece is a change to that test.
- *Left as they are:* Join the row goes by grid positions, so a layout
  someone made on purpose and then lost its proof (a merge cell's feed) can
  be read as a cut; a move keeps a split's joins with the column, as
  Fractal's grid does, so a block dragged into the split column feeds the
  branch; and the plan joins only the columns it moved (a cut it leaves is
  said after, not mended by itself). A move's note keeps saying its row
  had its Input and Output for as long as it is drawn, so if the Output is
  then moved to another row OFF the app (the unit's front panel, Axe-Edit)
  while the note is showing, Join the row from that note answers "Row 3
  has no Output now, and no sound" over a row that plays through the other
  row's (the eighth round's review, minor: it takes an edit off the app
  between the move and the press). The browser goes by the version of
  the computer app that builds its joins (`builtElsewhere`): through the
  relay, or the hosted website open on the computer that runs the app
  (that app's version read from its own host.name, link.js `readMac`), one
  older than 1.90.82 or not saying is held to the old bytes; the
  computer's own window and Wi-Fi page are this release.
- The browser's half is inside the computer app, so this made a computer
  release; COMPUTER_NEEDED did not move.

**The Output block's levels: IN and OUT in Edit over Bluetooth, the volume
button there, and each scene's own level. Built 16 November 2026, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then), and NONE OF IT HAS BEEN SEEN ON A UNIT.**

> "Scenes levels and IN and OUT blocks" (a customer, an FM9 over Bluetooth
> through a WIDI Master on an iPhone, 16 November 2026)

Over Bluetooth the wire threw the Input and Output blocks away (bleWire
`OFF_STAGE`, from when Bluetooth was Play only), so Edit had no IN or OUT
there and the top bar no volume button; and on every connection a scene's
level (the Output block's Scene 1 to 8 Level, -20 to +20 dB, ids 18 to 25
on the FM3, FM9 and Axe-Fx III alike, each by its own catalog) came with
every read of the block and was never drawn, since Edit keeps every
"...Level" off its knobs. One switch now, `OUTPUT_AND_SCENE_LEVELS_FOR_EVERYONE`
in features.js, true since 2.0.1 (false until 17 November 2026), asked through lib/bluetooth `outputAndSceneLevels`
(his account, or the switch) and handed to the wire as `io`, which also
wants Edit open (bleWire `ioOn`). For his account:

- *Over Bluetooth or a USB cable* (FM3, FM9, Axe-Fx III; an AM4 lists no
  Output block) the chain answer hands the Input and Output on, so Edit
  draws them as the chain's ends, as through the computer, and the speaker
  appears on the top bar. Play still never shows them (`stageBlocks`), and
  the looper stays out. The Bluetooth page's last line drops "volume
  button" only where the button is there (lib/editWords
  `notOverBluetoothLine`, lib/bluetooth `volumeOverBluetooth`).
- *The volume moves Output 1* (lib/sceneLevel `volumeOutput`: the lowest
  Output id, 42), whatever order the chain lists them in; the speaker and
  the pop-up ask the same helper.
- *The volume pop-up has a THIS SCENE row*: the level of the scene the unit
  is on, read out of the same Output read (nothing more is asked), − and +
  a whole dB, written as any knob (setParam, then one checked write once
  the presses stop, one check at a time). Never under -20 dB or over +20,
  never stepped from a level not read, a press on one preset never
  confirmed on another, and a footswitch to another scene shows that
  scene's own level.
- *Edit's Output block has SCENE LEVELS*: the eight as typed boxes under
  its Level (`sceneRowsFor`), held to the floor, written as a knob is. Not
  in the hold pop-up.
- *A value that sends nothing is let go of* (an independent read, 16
  November 2026): a scene's level, or the Level, typed past its end while
  already there left its value waiting with nothing to send it, and the
  knobs following the unit stood still behind it (Edit `settledAt`).
- *Every other account sees and sends exactly what it did*: the wire leaves
  both blocks out of its answer, a read or write of either is refused
  before it goes ("The app can't open/change block N from here yet") and
  again at the way out (`editHeld`), the volume moves the first Output
  listed, and there is no row. test/bluetooth.mjs, test/volume-drag.mjs and
  test/mobile.mjs hold it, each rule seen to fail by a mutation.

NOT PROVEN ON A UNIT, and what to read first in his log: whether an FM9
lists its Input and Output (37 to 40, 42 to 44) in its status answer over
Bluetooth (if not, Edit gets no IN or OUT and every read of them is refused
as not in the preset); how many values its Output block's read carries
(the codec says one set of 26; the read line "the unit said N values"
settles it); and whether a Scene N Level write lands where asked (set +3.0
dB from the app and read it on the unit's screen), and whether a level
written for a scene the unit is not on is the one heard when that scene is
called. A level changed on the unit itself shows only at the pop-up's next
open. A change plays and is lost at the next preset change unless the
preset is saved. OPENING IT TO CUSTOMERS is his call once he has moved a
scene level himself over Bluetooth and through the computer: by update, or
in a store version whose texts say so, since the Bluetooth page every
customer reads says there is no volume button. The browser and the
computer's window have none of it (a computer release).

**TONE3000 for the AX3's NAM block: started 13 November 2026, HIS ACCOUNT
ONLY. A capture can be sent to the unit from the Developer card since
1.90.58, and through the computer or the Raspberry Pi since 1.90.59. HIS UNIT HAS KEPT TWO CAPTURES
SENT FROM THE APP AND DROPPED THREE (14 November 2026, through the Raspberry
Pi); 1.90.70 sends one it drops again another way. THROUGH THE PI ON
COMPUTER APP 1.90.90 IT KEPT TWO OF TWO, EACH ON THE FIRST TRY (17 November
2026, his log: name byte 0x60 with the file's hash, in 0.5 and 0.6 s, slots
043 and 044, each named back by the unit and played in NAM 1; the same Pi
on 1.90.63 had dropped four that afternoon). IT WENT TO THE PUBLIC WITH
STORE VERSION 2.0.0: open to every account since 2.0.1 (17 November 2026),
from a held NAM block and from Edit's Capture screen; the Developer card
with the sender stays his.**

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
  terms, which the code keeps: TONE3000's name on everything of its that
  is shown ("Powered by TONE3000"), the creator on every row and on a
  tone's own view, the licence on a tone's view, a capture fetched only
  when a player asks for it, nothing cached or fetched ahead. (Until 1.90.65 everything browsed was TONE3000's own
  page; since then the app draws a list of its own too, below, which
  their Design Requirements allow and say how.)
- **Use TONE3000's own example, never memory.** github.com/tone-3000/api
  has the same three demo apps in six stacks; web/src/tone3000-client.ts
  is where every address, field and answer in lib/tone3000.js came from
  (the pick-a-tone page is `prompt=select_tone` with `format=nam`,
  `architecture=2`, `preview=true`; leaving `architecture` out returns the
  older kind only). Its ios/, android/ and react-native/ examples are the
  in-app version, and all three do it the same way: TONE3000's page in a
  WEB VIEW in a sheet with a Close button, the return address caught inside
  the web view, the pass in the Keychain or Keystore, the one-time word
  from the platform's random numbers. Their ios/README.md says why a web
  view and not the phone's sign-in sheet: "That avoids the system "Wants to
  Use … to Sign In" prompt, and the TONE3000 session persists so later
  flows skip sign-in." TWO DIFFERENT PLAYERS, not to be mixed up: the
  players on TONE3000's own page ("the hosted catalog's preview players",
  `preview=true`) are for listening BEFORE a tone is picked, and are all
  this app uses; and every one of their demos, the pick-a-tone one
  included, ALSO previews the picked tone's captures afterwards with a
  native C++ player (the open NAM engine run on the phone). This app has
  no such player: after the pick, hearing a capture means sending it to
  the unit. Whether a player on the phone is wanted is a decision still to
  make, and it would be a native piece of its own (another build). READ THE
  PHONE EXAMPLES BEFORE CHOOSING A NATIVE PIECE: on 14 November 2026 the
  phone's in-app browser (expo-web-browser) had been mapped in full, with
  its three unknowns that only a device could settle, before their
  examples were opened and showed a web view with none of them.
- **THE LIST IS DRAWN IN THE APP SINCE 1.90.65 (14 November 2026), on a
  page of its own: Developer → TONE3000, HIS ACCOUNT ONLY.** "Do you want
  me to resend you the screenshot I sent you from the headrush Remote app
  I created. It to look like that and function like that. Not just going
  off a built-in web browser in our app but actually native in our app
  using the API ... Make it look just like this and function like that."
  He had been shown the web-view page and a picture of it; what he wanted
  was the Tones tab of his HeadRush app (headrush mobile/src/t3k.tsx,
  read, never changed). So, by update and with no build:
  - *What it is.* A search box and a Search button; one row of chips that
    slides sideways, the order (Trending, Newest, Most downloaded) and then
    the kind of gear (All, Amps, Amp + Cab, Pedals); a row a tone with its
    picture, its title, and "maker · kind · NAM · 44,988 downloads" with
    the maker's picture; More under the last. A tap on a tone shows it on
    the same page, laid out as his HeadRush tone view is (1.90.66, below):
    the title with ‹ Back beside it, its picture with the maker, the gear,
    the description and the licence, then a line a capture with Preview
    and Get. The steps are behind the ⓘ, as on his HeadRush tab.
    components/Tone3000Browser draws the list, lib/tone3000Browse holds
    what is asked and when, lib/tone3000 `search`, `feed` and `me` do the
    asking, components/Tone3000Test is the page.
  - *PREVIEW AND GET ON EACH CAPTURE (1.90.66).* "And then, after clicking
    on one, it has a preview and a get button" (the same day, with a
    picture of the HeadRush app's tone view: title and Back, picture,
    "amalgamaudio · amp-cab", the gear, the description, "A2 models", and
    a capture's name with Preview and Get beside it). The look is copied.
    WHAT THE BUTTONS DO IS NOT THE HEADRUSH'S, and the steps behind the ⓘ
    say so: that board is on the internet and plays a capture without
    keeping it; an AX3 plays only what is in one of its capture slots. So
    BOTH put the capture in the unit's first empty slot (the one send
    there has always been). **Preview** then points NAM 1 at it, so it is
    heard through his rig; **Get** leaves what is playing alone. The view
    says so itself, under the heading, not only behind the ⓘ ("Preview and
    Get both put the capture in an empty slot on the unit, and it stays
    there. Preview also plays it in NAM 1."). The old single button (Send
    it and play it in NAM 1) and Check the file only are gone. NEVER A
    SENTENCE THAT SAYS A PREVIEW IS NOT KEPT (a test scans what the view
    shows and reads aloud for the usual ways of saying it).
  - *What the app has put on the unit is remembered for as long as the app
    runs* (`placed`, outside the component, by TONE3000's capture id): the
    line says "On the unit · slot 030", has Play it in NAM 1 / NAM 2 under
    it, and has no Preview or Get, on this view and after Back and the
    same tone again. A second copy would take a second slot, which
    nothing in the app can give back. "On the unit" only where the unit
    said the slot holds it; a send it took and said nothing of is "Sent
    to slot 030" until a NAM block pointed at it names what is there. It
    is forgotten only when the unit names the slot <EMPTY> (and when the
    app is closed: the unit is not asked what it holds when a tone opens).
  - *"✓ Playing in NAM 1" (17 November 2026, his account only, as the
    whole page is; on the Developer page only since later that day, when a
    held block's page lost its Play button: below).* A tap on Play it in
    NAM 1 when NAM 1 already played
    that capture looked as if it did nothing. Now, where the unit itself
    has said on this page that a block is on a capture's slot (by Preview,
    Get and play, or Play it in), that block's button under it says "✓
    Playing in NAM 1"; a tap still asks the unit, and the line then says
    "Asked the unit again: NAM 1 is playing “…”. Save the preset to keep
    it there." The tick goes the moment it cannot be vouched for: another
    preset or scene, the same preset loaded again where the app hears of
    it as a reload (the rig's `bufferRev`: the preset tapped again in the
    app, or, through a computer, a Revert or a select from another
    editor), the link down, a pick in that block that failed or named an
    empty slot, another capture played in that block, the page left. The
    tick is what the unit said after this page's own last pick, on this
    visit, and a change made to the block at the unit or in another editor
    is not seen until the preset or scene moves or the button is tapped.
    LEFT, found by the second read: over Bluetooth, the same preset loaded
    again AT THE UNIT (its own footswitch) reaches the phone as a Program
    Change for the number it is already on, which the rig does not count
    as a reload there (rig.js followPresetNews: `reloaded` only where the
    computer keeps a copy), so the tick stays over a pick the unit has
    thrown away, until a tap asks again. Counting that Program Change as a
    reload would change what every Bluetooth player's Edit does when an
    adapter sends the app's own preset change back, so it was not done for
    a tick; it is the same question as whether Edit's knobs should be read
    again there, and wants a log first. The rule and its words are
    lib/namPlaying, run whole by test/nam-playing.mjs. Not seen on a unit
    yet.
  - *Two readers and a skeptic each went through it before it went out.*
    What they found, each fixed with a test seen to fail without the fix
    (15): Back and the same tone again offered both buttons on a capture
    already sent; a tone picked on TONE3000's page while a capture's FILE
    was still coming opened over it, and the capture then went to the
    unit, and into NAM 1, with no line on the screen (the "a send is
    going" mark went up after the fetch; it goes up before it now); "On
    the unit" over a slot the unit had not named; a Play under one capture
    took away another's Send it again (a stopped send is kept by capture
    now); a file that read as A2 and that the packer refuses kept its
    buttons under two lines that contradicted each other; nothing on the
    view said a preview stays in its slot.
  - *FROM A HELD NAM BLOCK, ON PLAY (1.90.67, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then)).* "I want
    it in the app in a few places. One is if they hold a nam block it pulls
    up the quick edit screen on top of it have it say tone 3000 where they
    can click on it and browse tones preview them and then download them
    directly and then it'll take them back to that screen so it's very
    streamlined." (14 November 2026, with a picture of NAM 2's quick edit.
    The second is the capture list in Edit, below; any other is his to
    name.) This is also where
    TONE3000 wants an app's way in: "associated with adding a tone to a
    signal block".
    - *What it is.* Hold NAM 1 or NAM 2 on Play: over the knobs, a button,
      TONE3000 ("Browse captures, preview them, and get one for NAM 2"). A
      tap puts TONE3000's list in the knobs' place IN THE SAME POP-UP (its
      title and its way out stay; the channels at its foot are put away
      while the list is up), with "‹ Back to NAM 2’s knobs" over it.
      **Preview** puts the capture on the unit and plays it in THAT block,
      and the page stays. **Get** does the same and gives the pop-up back
      to the knobs, with what the block said it is playing over them. A
      capture already on the unit keeps the same two buttons (below). The
      page is the Developer page's own (components/Tone3000Test with
      `block`, `held`, `onDone`); what each button says it does is
      lib/tone3000Words, for the place it is in.
    - *THE SAME TWO BUTTONS ON EVERY CAPTURE, AND A BLOCK THAT IS OFF IS
      SWITCHED ON (17 November 2026).* "On this screen, what's the
      difference between get it and use it and go back? Little confusing.
      If I click each of those, would it do the same thing? Also ... if
      the NAM block is off when you hold it to browse tone 3000, does it
      turn it on so you can listen to it, or does it leave it off? need to
      make sure that it turns it on automatically to listen" (with a
      picture of NAM 2's page: one capture with Preview and Get, and one
      already on the unit with "✓ Playing in NAM 2" and "Use it and go
      back" under its card). They did the same thing: a capture already on
      the unit had traded its two buttons for two of another name. So from
      a held block, and from the capture list in Edit, EVERY capture has
      Preview and Get: one already on the unit is played where it is
      (Preview), or played and the page handed back (Get), with nothing
      sent again, and the button tapped says "Changing…" while the pick is
      out. "Use it and go back" and its words are gone. The Developer page
      is as it was (there Get leaves what is playing alone, so a capture on
      the unit has a Play button for each NAM block). AND THE BLOCK IS
      SWITCHED ON: a pick only chooses the capture, so a preview in a block
      that was off made no sound while the line said "is playing". Now,
      once the unit has NAMED a capture in the block, a block the chain on
      screen shows as off is switched on, from every button of the page
      that plays one, the Developer page's too (lib/namPlaying
      `switchOnToHear`; lib/namOnHere sends it, by the rig's own switch,
      the one Edit's block page uses, read by rig `blockIsOff`). The line
      then says "NAM 2 was off, so it is switched on now, and it is playing
      …"; where the switch did not land it says the app couldn't switch it
      on and to switch it on if nothing is heard (claiming nothing of the
      block's state: an answer that was lost may have landed), as a note
      under the card and never as "is playing". ONLY THEN: nothing is sent
      for a block that is on, for one the chain on screen does not hold,
      after a pick that failed or named an empty slot, or once the preset
      or the scene has moved since the TAP; and it is on only, for the
      scene the unit is on (lib/namOnHere cannot switch a block off; a test
      holds it). The card now reaches a unit by the captures' three calls
      and that one switch.
      THREE READERS AND A SKEPTIC EACH WENT THROUGH IT FIRST, and four
      things were fixed, each with a test seen to fail without it: (1) a
      capture that is SENT first (half a minute over Bluetooth) was held
      to where the unit was when the block was pointed, not when the
      button was tapped, so a scene stepped to during the send had the
      block switched on in it; the moment is taken at the tap now
      (`tappedAt`), and a block that is off where the unit has moved to is
      LEFT off and said so ("… the app left it off, because the scene, the
      preset or the connection changed after your tap"); (2) the Developer
      page ticked "✓ Playing in NAM 1" over a block that had stayed off
      (not ticked now: `saysPlaying`, heardPick's `off`); (3) right after
      a scene change whose status read missed, the on and off on screen is
      the last scene's for about 0.6 s, and was answered as this scene's
      (rig `blockIsOff` answers nothing while that read is owed); (4) the
      check on what the card can reach skipped files with a hyphen in
      their name. Left as it is, and known: where both tries at a scene's
      status read miss, the last scene's on and off stays on screen until
      the next read, here as on Play's own tiles.
      NOT SEEN ON A UNIT: his next preview into a block that is off is the
      check, and its log line is "NAM 2 was off: switched on, so the
      capture is heard". Not covered: a block switched off at the unit's
      own front panel since the app last read it still reads as on here,
      as its tile on Play does.
    - *Get goes back only when the block has NAMED what it is playing.* A
      slot the unit calls empty, a pick it refused and one that never came
      back leave the page up with the reason on it.
    - *Where.* lib/tone3000Quick: a block filed as NAM whose effect id is
      one of the capture tools' two, in the pop-up that has the knobs. The
      pop-up with the channels alone is word for word what it was, and so
      is every other account's: the switch is
      `TONE3000_QUICK_FOR_EVERYONE` in features.js, true since 2.0.1 (false until 17 November 2026)
      (lib/useTone3000Quick). Play's own file holds the door's three names
      (components/Tone3000Quick) and nothing else of TONE3000's; a test
      holds that.
    - *ON THE CAPTURE LIST IN EDIT TOO (1.90.68).* "Also want it on the
      capture screen when I can they see the ones they've already
      downloaded but then they can also click tone 3000 from that and it
      pulls up and they can browse preview and do it that way as well"
      (the same day, with a picture of the Capture sheet). Over the
      captures on the unit, the same TONE3000 button; a tap puts the same
      page in the list's place IN THAT SHEET, with "‹ Back to the captures
      on the unit" over it. Preview and Get play in the block the picker
      is drawn for; Get then gives the sheet back to the list, with what
      the block is playing over it. When the list comes back it is read
      again if a capture was sent, and Edit reads the block again
      (components/CapturePicker `onChanged`, Edit `captureChanged`): the
      page points the block by its own pick, not Edit's, so the Capture
      button would otherwise still name the old one. The picker itself
      still writes nothing to the unit, and Edit's file holds nothing of
      TONE3000's. Same gate: his account, `TONE3000_QUICK_FOR_EVERYONE`,
      and it is inside the capture picker, which is his account's too.
      Two readers and a skeptic each went through it first. Fixed, each
      with a test seen to fail without it (31): Edit's read after the
      page was dropped if another was still out, and went by what was so
      when Get was tapped, half a minute before (lib/captureReread, which
      a test runs whole: one more read after the one out, and everything
      asked for when it runs); a read that failed left the button on the
      old capture and no Save offered, after the page had said to save
      (the page says which slot the unit named, `onPointed`, and that is
      believed where the read says nothing); a pick still out when the
      sheet was closed tells Edit when it lands; the tone's Back says
      "Back to the tones", since "the list" is also what the captures on
      the unit are; and the TONE3000 button's words are in the live
      colour, in both places, because in plain ink over the captures it
      read as one more capture.
      And the fixes were read too, which found two more: an earlier slot
      stayed vouched for after a later pick answered <EMPTY> or failed
      (the page says the empty slot, and says none after a failure), and
      a pick of Edit's own with its read still out let the outside read
      run over it (the outside one stands back and reads once the pick
      is over, `after()`).
    - *Two readers and a skeptic each went through it first.* Fixed, each
      with a test seen to fail without it (18): a send that landed after
      the page had gone (the pop-up closed, a preset changed on the unit)
      was forgotten, so the capture was offered again and took a second
      slot (it is written down before anything asks whether the page is
      still up); the way back to the knobs waits while a capture is going;
      Get said it always goes back (it says "once NAM 2 is playing it"
      now); the wrong button said Sending; two Backs one over the other
      (the tone's says "Back to the list" there); Sign out is not drawn in
      the pop-up; and the sheet's two pages each start at their own top
      (Sheet `scrollKey`).
    - RUN ON HIS PHONE, 16 November 2026 (his log, through the Pi): hold
      NAM 1, TONE3000, a tone picked, Preview, then Back to NAM 1's knobs
      and the same again with another tone. The list inside the pop-up's
      sheet (a sheet in a sheet) worked; its search box was not seen used
      (the log has the pick, not how it was found). NOT SEEN YET:
      TONE3000's own page coming up over that sheet, and a half-minute
      send over Bluetooth with the pop-up open (both of his went through
      the Pi, about 2.3 s a try, two tries each).
      OPENING IT TO CUSTOMERS IS A STORE VERSION (new for them, the capture
      tools answer his account alone on the wire, and TONE3000 signs the
      screen off first), never the switch alone. IT OPENED WITH 2.0.0 (17
      November 2026, in 2.0.1): the wire's gate opened with it
      (`capturesOverBluetooth`), and what a customer needed besides is in
      *Everything that was his account's is open*, above.
  - *A PREVIEW THAT DOES NOT FILL A SLOT IS NOT BUILT, AND CANNOT BE FROM
    WHAT IS KNOWN.* Ten previews are ten slots. Reusing one slot means
    writing over a capture or clearing one, and the only upload ever
    recorded went into an EMPTY slot: what Axe-Edit sends to replace or
    remove a capture is not known, and a byte Axe-Edit has not been seen
    to send is not sent (the name's check byte was that lesson). A MIDI
    Monitor recording of Axe-Edit III removing one capture, and of it
    loading one over a slot in use, is what would settle it. And no send
    from the app has been KEPT by his unit yet at all (above): that comes
    first.
  - *TONE3000 IS ASKED ONLY WHEN THE LIST OPENS, ON SEARCH, ON A CHIP AND
    FOR MORE.* Never on a keystroke or a clock: its search is "heavily
    rate-limited by default". A test fails on a clock in either file and
    on a second `onChangeText`. Always `format=nam` and `architecture=2`
    (25 to a page, the most it gives), so only tones the AX3's NAM block
    plays are listed. A chip asks with the words in the box, as Search
    does and as his HeadRush tab's chips do. An answer to anything but the
    newest question is thrown away. The list lives while the page is up,
    so Back from a tone asks nothing; nothing is written down.
  - *ITS SEARCH IS OPEN TO HIS KEY, AND THE LIST HAS RUN ON HIS PHONE.*
    "The search features work great in the app, so that API is working"
    (14 November 2026). What follows is for a key it is NOT open to, which
    is no longer his case. If TONE3000 answers
    403 the page shows its own short trending list for Trending and its
    newest for Newest (ten at most, which every key may ask for, cut down
    here to what the NAM block plays, so the note gives no number), says
    "TONE3000 hasn’t opened its search to this app yet", and does not ask
    search again while it is up. If he sees that sentence, the key's
    agreement is what to raise with TONE3000; nothing in the app is wrong.
  - *Before a sign-in* the page is TONE3000's own "partnership splash" (its
    Design Requirements' words, with the app's name in and the impulse
    responses out) and Continue, which opens TONE3000's SIGN-IN ALONE
    (`start({ pick: false })`: its "prompt omitted: standard authorization
    only") and comes straight back to the list. Their requirements say the
    sign-in is "via the TONE3000 Select flow" and also that "a tone list
    view is the first view they should see" after it; the pick-a-tone page
    would put their catalog first, so the plain sign-in was chosen. NOT
    TRIED ON A PHONE: if Continue does not come back signed in, Browse
    TONE3000 (the pick-a-tone page, which his phone has run) signs in too.
  - *NO WEB PAGE OF TONE3000'S TO BROWSE ON, since 1.90.70.* "I don't want
    it to access their web browser directly through our app. I wanna use
    the API." (14 November 2026.) Browse TONE3000 (their pick-a-tone page)
    and "Open TONE3000 in the browser instead" are not drawn on any
    signed-in view, and no sentence names them (`T3K_CATALOG_PAGE` in
    lib/tone3000Words, false). Their written rule asks for "a clear,
    persistent path to browse the full TONE3000 catalog via the Select
    flow"; if they hold him to it at sign-off, that one word brings the
    button and its sentences back. THE SIGN-IN IS STILL TONE3000'S OWN
    PAGE (an email, then a code), once: their API has no other way to sign
    somebody in (authorization code and refresh, nothing else, in all six
    of their examples). In the browser on every copy out today; inside the
    app, in a sheet, from the build that carries the web view. The app has
    no player, so a capture is heard by sending it to the unit.
  - *WHOSE NAME IS ON THE PAGE.* "@justinnewbold" beside TONE3000 is the
    TONE3000 account signed in on that device, his own on his phone. A
    customer signs in to theirs and sees theirs. Nothing on his account
    needs changing for it.
  - *A sign-in TONE3000 no longer takes* (401, to any request the page
    makes: the list, whose sign-in it is, a tone, its captures, a
    capture's file) puts the page back on its sign-in view with "Your
    TONE3000 sign-in has run out", in place of a list that can only fail.
  - *A RETURN OF TONE3000'S IS TAKEN UP ONCE FOR AS LONG AS THE APP RUNS*
    (`taken`, outside the component). The phone hands the link that
    started the app back every time it is asked, and the page asks at
    each drawing; finishing an old return throws away the sign-in under
    way. And a tone picked on TONE3000's page while a capture is going to
    the unit is not opened over it.
  - *NOT YET, and wanted before TONE3000 signs off anything a customer
    sees* (their Design Requirements, tone3000.com/api): their Favorites,
    Created and Downloaded tabs; their logo in place of their name in type
    (they give the files); the way in from Edit's NAM block, beside the
    capture picker (the one from Play's hold pop-up is built, above, his
    account); the tone's picture and TONE3000's mark on the NAM block that
    plays a capture sent from it; and the splash's wording, and the plain
    sign-in in place of the pick-a-tone page, agreed with them.
  - IT HAS RUN ON HIS PHONE AGAINST TONE3000 (14 November 2026, 1.90.66
    and 1.90.67, his picture of a tone's view and his log): the sign-in,
    the search, a tone's captures, and sends to his unit through the
    Raspberry Pi.
  - Four readers and a skeptic each went through a frozen copy before it
    went out, and found sixteen things, none of them in what is sent to a
    unit: a More button left up after TONE3000 refused a further page,
    which then asked nothing for ever; Continue greyed for good when the
    sign-in ran out during a tone's fetch; the old return above; whose
    sign-in it is going stale; "its own top ten" over the ten NEWEST or
    over nothing; "has everything" of a page opened for the NAM block's
    captures alone; "Tap Browse TONE3000 again" on a view that has no such
    button. Each has a test that was run with its fix taken out and seen
    to fail (22 of them). WORDS THAT NAME A BUTTON ARE CHECKED AGAINST
    EVERY VIEW THEY CAN APPEAR ON.
- **What was built first (1.90.55): Developer → Testing → TONE3000, now
  Developer → TONE3000.** Browse
  opens TONE3000's page in the device's browser (sign in, search, audition
  on its own players, pick), TONE3000 sends the device back by the app's
  link, and the card shows the tone, its creator and licence and its A2
  captures; a capture can be fetched and counted (lib/nam-file.js). No new
  package and no build: SHA-256 is written out (lib/sha256.js), the pass is
  in the app's ordinary storage (secure storage is native), and the
  one-time word uses the engine's secure random numbers where it has them.
  On a page only his account has, so it has no switch yet; it gets one in
  lib/features when it moves to where a player meets it.
- **INSIDE THE APP: WRITTEN, WAITING FOR A BUILD (1.90.64, 14 November
  2026).** "Have you built out the built-in tone 3000 into our app so you
  don't have to go to Safari?" It had not been, and a web view is native.
  So it is in two halves, and the half that is code is already merged:
  - *The patch*, docs/pending/tone3000-in-app.patch: react-native-webview
    13.16.1, expo-secure-store ~57.0.4 and expo-crypto ~57.0.4. Three
    packages and nothing else: nothing in app.json, nothing of the app's
    own. It moves the android and ios lines, so it is a build pair he has
    to say yes to.
  - *THE SECURE STORAGE'S PLUGIN IS NEVER LISTED IN app.json.* The first
    cut listed it (with its Face ID sentence switched off) and called its
    Android half good practice. Its Android half is two backup rule files
    that name the app's settings file to include, and once a rule names
    something Android backs up ONLY that: the app's own sign-in, setlists
    and settings, which are in a database, would have stopped going to a
    customer's new phone, for every Android customer, from a patch meant
    for one Developer card. A reviewer read the two files; a build would
    have shipped it. So: A PACKAGE'S PLUGIN IS READ BEFORE IT IS LISTED,
    down to the files it puts in the app, and what it does to an app that
    listed nothing before is asked for the whole app, not for the
    feature. The package works without its plugin. A test fails on the
    plugin and on any backup rule in app.json.
  - *The code*, in the tree and doing nothing new on any copy out today:
    lib/tone3000Parts asks for each package with `require` inside a `try`
    of its own and gives `null` for one that is not there (Expo's bundler
    lets a missing package through when it is asked for that way; a plain
    `import` of a package that is not installed stops the app bundling,
    and a test fails on one). lib/tone3000Here uses each where it came:
    the page inside the app (components/Tone3000Page, whose rules are
    lib/tone3000Page), the pass in the secure storage on that phone only,
    moved there from the ordinary storage the first time it is read so
    the build signs nobody out (lib/tone3000Keep `movingStore`), and the
    one-time word from the phone's secure random numbers (`sureRandom`).
    Where a piece did not come, exactly what it did before: the browser,
    the ordinary storage, `randomBytes`.
  - *The browser stays one tap away*: "Open TONE3000 in the browser
    instead", under Browse, only on a copy that has the page. A sign-in
    that will not run inside a web view (Google's does not) then needs no
    update. And the app's own link is still listened for on every copy.
  - *The app never reaches into TONE3000's page*: no code put into it,
    nothing read out of it, no name given to it (a test holds the web
    view to that). Only the address it is sent back to is read.
  - NOT SEEN ON A PHONE: nothing of this has run on one. The two free
    builds (android-minified.yml on the pull request, duo.yml by hand)
    show the pieces compile and the app starts with them in, not the
    page. docs/pending/README.md has what only a real phone can show.
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
  - *TWO CAPTURES KEPT AND THREE DROPPED, AND WHAT TOLD THEM APART (14
    November 2026, through his Raspberry Pi, his log).* THE FIRST CAPTURES
    SENT FROM THE APP THAT HIS UNIT KEPT: "Jcm800" (slot 034, a short name,
    as it was) and "MES DRECF RD Gain2 BAL O808 CAB" (slot 035), each
    picked in Edit afterwards and saved in a preset. DROPPED, every
    message "taken": "FNDR BFSR VB Edge WRM2 CAB FREE" (three times, two
    slots), "CL Gain 1 Bright" and "CL Gain 3" (each also with its name
    filled out). The 32nd byte of the name, which the app filled with the
    name XORed, was 0x7C and 0x78 in the two kept and 0x02, 0x1D, 0x3D
    and 0x1D in the dropped; Axe-Edit's own was 0x60. EVERY BYTE KEPT HAS
    0x60'S TWO BITS SET AND NONE DROPPED HAS. So the likelier reading is
    that the byte is no check of the name and Axe-Edit sends 0x60 every
    time (its one recorded name happens to XOR to 0x60, which is how the
    XOR was believed). SETTLED AND DONE, 16 NOVEMBER 2026 (his log):
    "FNDR BFSR VB Edge WRM2 CAB FREE" (XORs to 0x02) was dropped every
    time it went with its name XORed, four more times through the Pi on a
    computer app that put the XOR in, and KEPT the first time it went with
    0x60 (over Bluetooth, slot 038); "EVH 5150III 100S stealth green" was
    kept with 0x60 (slot 037). 0X60 IS THE ONLY BYTE, AT BOTH ENDS, since
    1.90.88: `namRecord` packs nothing else (no `check` any more; the name
    XORed is worked out only for the log's "XORs to"), and the computer
    (ForgeFX acdd38d) puts 0x60, never the XOR, into a record that came
    with a nought.
    - *A capture the unit takes and does not keep is sent once more*
      (lib/captureSend `CAPTURE_WAYS`, run whole by a test): 0x60 with the
      file's hash, then 0x60 with no hash. From 1.90.70 to 1.90.87 the
      name XORed was tried too; those ways are gone. A way that would send
      the same record twice is left out (a file with no hash has one), the
      way the unit last kept one by goes first for the next capture
      (`keptWay`), and the filling out of short names is gone (one was
      kept as it was).
    - *The log is written to settle it in one session*: the file's own
      notes once (its texts, loudness, gain, levels, whether it has a
      hash), then for each try the byte that went, with or without the
      hash, how long the unit took over the closing message, and what the
      slot read as. READ THOSE LINES FIRST when he sends a log.
    - *The computer no longer writes its own byte in* (ForgeFX 64c44a7,
      the computer release that carries it): it sent the name XORed
      whatever the phone packed, so through the Pi the phone could not
      try 0x60. It sends what it is given and answers `nameByte` and
      `closing`. Through an older computer app the answer has neither,
      the phone knows the XOR went (the unit drops most of those) and its
      log says to update the computer app. HIS PI HAS TO TAKE THAT UPDATE
      before a send through it carries 0x60.
    - *SEEN AGAIN, 16 November 2026, and now said on the screen.* Two
      Previews from the held NAM block went through "raspberry pi 5" on
      computer app 1.90.63 and were dropped, name bytes 0x02 ("FNDR BFSR
      VB Edge WRM2 CAB FREE") and 0x17 ("MRSH JC800 Hi Lead2 BAL2 CAB"):
      two more for "every byte dropped lacks 0x60's two bits". The card
      said only "… so it did not keep it. The app's log has what the unit
      answered each time." Since 1.91.8 (lib/captureComputer, run whole
      by test/capture-computer.mjs, which drives the card itself): THROUGH
      A COMPUTER WHOSE APP SAYS A VERSION OLDER THAN 1.90.70 NOTHING IS
      SENT. 1.90.70 is the computer release that pinned ForgeFX 64c44a7
      (the byte as packed, and `nameByte`); this phone packs 0x60, so from
      it on 0x60 goes. The tone's view says once, up top, "The computer
      app on raspberry pi 5 is version 1.90.63. The Axe-Fx III drops most
      captures sent through one that old. Update the computer app to
      1.90.70 or later, then send it again. Or connect over Bluetooth,
      which sends it from this phone." (the device's own word), and a
      Preview, Get or Send it again sends and fetches nothing and puts
      the same words on that capture's card in place of the one up top.
      Never over Bluetooth, the unit's USB cable or the demo, never on a
      version not said, and playing a capture already on the unit (Play
      it in NAM 1, a held block's Preview and Get on one that is there,
      the capture picker) is not a send.
      Where the version was not said and the answer had no `nameByte`
      (lib/captureSend `old`), a capture not kept says the same reason
      and remedy in place of the log sentence; every other not-kept case
      keeps its words. The log line is as it was. His Pis (both on
      1.90.63) and anybody else's older computer app: update to 1.90.70
      or later; COMPUTER_NEEDED did not move (captures are his account's).
      THE REFUSAL IS FOR EVERY CAPTURE, ON PURPOSE: it also turns away a
      name whose XOR has 0x60's two bits (0x7C and 0x78 were kept through
      such a computer app on 14 November), which by that reading an old
      computer app would have got kept. One rule and the remedy that
      mends all of them, in place of a guess per name.
    - *0x60 was kept every time, so it is the only byte and the XOR ways
      are dropped* (done 16 November 2026, 1.90.88, above).
    - *Two readers and a skeptic each went through it before it went
      out.* Fixed, each with a test seen to fail without it (33 in all):
      through an older computer app the same record went twice when the
      way tried first was the name XORed (any answer with no byte in it
      is an older computer app, whichever way went); a later try was sent
      "over what is there", which would have written over a capture the
      unit had filed late; a send the unit took and said nothing of was
      drawn as a green tick with its own sentence hidden (the card is
      green and ticked only where the unit named the slot, and the phone
      taps only then); and a search that is not open ended in a sentence
      with nowhere to go.
  - *ON THE UNIT IS A GREEN CARD, since 1.90.70.* "Need better
    confirmation that a tone was sent. It doesn't do much after a tone
    does send successfully." A capture on the unit has a card under its
    name (components/SentCard): a tick and "On your Axe-Fx III" in the
    green that means done, the slot and the capture's name, and what the
    block says it is playing; the phone taps once. The same card is over
    the knobs, or the captures on the unit, when a Get hands them back.
    "On" only where the unit named the slot; else "Sent to".
  - *AND FROM THE TAP ON, since 1.90.71.* "This is the screen that shows
    up after hitting send.." (the same day, with a picture of a tone's
    view at 1.90.66 that had nothing on it to say a tap had been taken).
    Under a capture's name there is now always a card: "Getting it from
    TONE3000…", then "Sending to your Axe-Fx III…" with how far it has
    got, then the green one, or "Not on your Axe-Fx III" in amber with
    the reason. Which, for every state, is lib/captureLine, run whole by
    a test; the page draws what it answers. A file that could not be
    fetched is said under the capture that was tapped (it was a note at
    the top of the page, out of sight) and is logged, and a tap on
    Preview or Get is in the log like every other button (it left no
    line, so his log could not say whether one had been made).
    AND WHAT AN INDEPENDENT READ FOUND before it went out, both fixed:
    a fetch tried again showed the LAST try's failure under "Getting it
    from TONE3000…" (the line comes down as the fetch starts); and "a
    capture is still going, tap again when it has finished" was drawn as
    the amber "Not on your Axe-Fx III" card (it is a plain line now,
    `wait`). Behind that one was a tap that did NOTHING: a send goes on
    after its page is left, and the page opened after it had taken what
    was on the unit once, as it was drawn, so a capture that landed a
    moment later still showed Preview and Get, and a tap on either
    returned without a word. What is on the unit lives in
    lib/capturePlaced now, run by a test, and every drawing of the page
    hears of a capture as it lands. A SECOND READ, OF THOSE FIXES, found
    two more, fixed too: the "still going" line came down only when the
    other send LANDED, so one that failed left it up for good (whoever
    does the work now says when it is over, kept or not: `settled`, and
    the line comes down only once nothing is going); and "In slot 035."
    was said under a card that already read "Slot 035" (a Play tapped on
    a capture with no send of its own has no line now). A THIRD, of
    those: a send that had been nothing but the "still going" line was
    kept as an empty shell once it cleared, still "the one in hand",
    which hid why an earlier send of that capture had stopped (it is let
    go of now: `waitOver` in lib/captureLine, run by the test). AND THE SMALL
    RUNNER USED FOR MUTATION CHECKS HAD BEEN SKIPPING A GROUP OF TESTS:
    test/tone3000-browse.mjs has two exported groups (`run` and
    `runPreviewAndGet`) and the runner called only `run`, so seven broken
    versions went "uncaught" by pins that were never run. A runner calls
    every exported run* of a file. The lesson above again, one level up:
    the thing that proves a guard fails has to be seen to run the guard.
  - *THE FIRST SEND WAS TAKEN AND NOT KEPT, AND THE NAME HAS A CHECK BYTE
    (14 November 2026).* His first send from the card, over Bluetooth: all
    130 messages answered "taken", and then "NAM 1 is playing “<EMPTY>”
    now". The app's record differed from Axe-Edit's by ONE byte, the name's
    32nd: Axe-Edit sent 0x60, the unit's list answers a NUL there, and the
    first build took that for the unit's own ending and sent a NUL. 0x60 is
    the name's other 31 bytes XORed together, so the name field XORs to
    nought (`namCheck`); `namRecord` sends it since 1.90.60. LIKELY, NOT
    PROVEN: it is the best reading of the bytes, and it stays "likely"
    until a send from the app is kept by his unit. (It was not: the byte
    is 0x60 for every name, settled 16 November 2026, above.) The lesson either way:
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
    otherwise write half a minute late. The hold runs from the slot's own
    first read to the slot read back after "it is over" (1.90.61), and the
    rests are Axe-Edit's (`NAM_REST`: 30 ms before the opening message,
    150 before "it is over", 350 of quiet before the slot is read back,
    each held by the clock in a test); a slot that reads <EMPTY> is read
    once more before it is called not kept. THE COMPUTER HOLDS THEM TOO,
    from the release that carries ForgeFX 14e2c4f (1.90.61): the whole send
    is one turn on its queue (`Transport.exclusive`), with the same rests
    and second look, and it puts the name's check byte into a record that
    came without it. A computer app from before that lets other requests
    in between a capture's messages: update the computer (or the Pi)
    before a send through it is judged.
  - *The log says how long the unit took over the closing message* (both
    senders, 1.90.61). In the recording: under 3 ms on average for every
    message before it, 272 ms for the last, most likely the unit filing
    the capture. A closing message answered as fast as the rest, and a
    slot that reads <EMPTY>, says the unit judged the record and dropped
    it; a slow one that still reads <EMPTY> says the trouble is later.
  - *A SHORT NAME IS SENT AS IT IS, THEN FILLED OUT IF THE UNIT DROPS IT*
    (1.90.61, the card and `namRecord`'s `fill`). The check byte is proven
    only for a name that fills all 31 places; for a shorter one its place
    is a guess. A short-named capture taken and not kept is sent once more
    into the same slot with its name filled out to 31 places with spaces
    (the proven shape), and names are read back without the spaces. The
    log says which was kept ("KEPT WITH THE NAME FILLED OUT, not as it
    was"). Kept as it is: the fill is never used. Only the filled one
    kept: fill every name until the short rule is understood. Neither
    kept: the check byte was not the reason.
  - *The send and its second try are lib/captureSend's, not the card's*
    (1.90.62), so a test runs every path of them against the stand-in
    unit. They went out inside the card, read only as text, and an
    independent read the same day found three things, fixed there: A UNIT
    SLOW TO FILE (the slot reads <EMPTY> at both looks, then holds it) had
    its second try refused "already holds", which the card said as a
    failure with no Play button, and the next tap sent a second copy; a
    second try refused because the slot holds THIS capture is the first
    send kept (`heldAlready`, "KEPT AS IT WAS" in the log). A second try
    that stopped part-way was sent again short name first; the failure
    now says what was going (`err.filled`) and "Send it again" sends
    that. And the wire's "(filled out with spaces)" is what the request
    says (`filled`), not the name's last place, where a long name cut at
    a space said it too. WHAT SHIPS UNREAD GETS READ: the reviewers'
    copy was frozen before these went in.
  - *Axe-Edit sends no "store it" message* (checked 14 November 2026,
    docs/nam-install.md): the 30 messages it sent between the unit's last
    answer and "it is over" are its own screen refreshing, the same reads
    it sent thousands of times before the upload. Not a missing step.
  - *One send at a time, whoever draws the card* (`atWork` in the card):
    a send goes on after the card is left, and the computer refuses no
    second one. A capture is named by the file's own word where any of it
    survives as plain ASCII, else TONE3000's name, else "Capture <id>",
    and never "<EMPTY>". What the card says a send takes is the record's
    real size (`RECORD_SEND` in lib/nam-file, 83,227 bytes, held to the
    130 messages by a test), not the old estimate.
  - *TONE3000 is waited for only so long* (1.90.61, lib/tone3000
    `exchange`): 30 seconds for an answer, 60 for a capture's file, the
    request and the reading of its body together. Before, a file that
    stopped half-way left the card on "Fetching" for good, and a renewal
    of the sign-in that stalled held every request after it until the app
    was closed. Every request the client makes goes through that one
    place (a test counts them).
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
- **The capture picker in Edit: built 14 November 2026 (1.90.63), OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then).** On a NAM block, first, over the knobs: a button, Capture,
  with the slot's number as the unit and Axe-Edit count it and the
  capture's name ("029 Orange Amp…"). A tap opens the captures on the unit
  with a box to find one; a pick points the block's channel at it and the
  block is read again, and what that read says is what the button shows
  (mobile/src/components/CapturePicker.js, lib/captureList.js for the
  list's rules, lib/captureListHere.js for the device's, screens/Edit
  `pickCapture`). Nothing is saved by a pick; the preset is saved the
  usual way.
  - *The switch* is `NAM_PICKER_FOR_EVERYONE` in features.js, true since 2.0.1 (false until 17 November 2026)
    (lib/useCapturePicker). OPENING IT IS MORE THAN THE SWITCH: the list
    and the pick go through the captures' routes, which the wire answers
    only for his account (`captures`, lib/bluetooth), and that same gate
    is the sender's. To open the picker and keep the sender his, the wire
    needs a gate of its own for the list and the pick. Its What's new line
    goes in then. (Both opened together on 17 November 2026, so the one
    gate opened for every account, `capturesOverBluetooth`; nothing keeps
    the sender his but the Developer card it sits on.)
  - *The pick is the captures' own write* (`namPickHere`, the typed write
    of setting 0 the card's Play it in NAM 1 sends), held by their guard.
    The capture has no row in Edit's list and must not get one: Edit's
    write for a list setting would be a second way to send it.
  - *The list is read as Axe-Edit reads it*, one question a slot, IN
    PIECES (`GET /nam/heads/<from>/<count>`, 32 slots at most a request:
    8 a piece on the device's own wire with a moment between two, 32
    through the computer), shown as it comes, and KEPT: in memory, and on
    the device under `fractal.captures`. About half a minute over a
    Bluetooth adapter the first time, a few seconds through a computer,
    and simply there after that. It is read again on Read the list again,
    after a capture is sent from the card (`onCaptureSent`), and when the
    slot a block is on reads as something other than the list has for it
    (that slot is asked by itself, fresh, each time a NAM block is opened,
    so the button never says a name the unit no longer has there).
  - *A slot that says nothing ends the piece* (`stopped`), AND NO SLOT IS
    ASKED UNTIL ITS ANSWER CAN NO LONGER COME. A slot's answer does not say
    which slot it is, so the next question asked, of any slot and by
    anyone (the list, a block's button, the card's search for an empty
    slot, an upload's own looks), would be handed the late one and file a
    name under the wrong slot. Both senders hold it themselves (bleWire
    `namQuietUntil`, two seconds as after a stored name on an AM4; ForgeFX
    `#namQuietUntil`, `NAM_LATE_MS`), and the list waits 2.5 seconds on
    top before any of its own slot questions (`again`). The list's wait is
    taken OUTSIDE its lane, so a pick tapped meanwhile goes straight in
    (it is no slot question), and an upload waits the quiet out BEFORE it
    takes its hold on the line, so a tap is not refused for a capture that
    has not begun. On the computer the wait is taken before a question
    joins the queue, and two lists can be read at once there (two phones,
    a request the relay sent twice), so a slot's answer is believed only
    if no slot went unanswered between its asking and its answer
    (`#namSilences`), and a quiet begun again while a question waits is
    waited out to its end. No wait is ever longer than the quiet itself,
    whatever the clock does.
  - *When the list gives up.* A slot that says nothing is asked once more;
    twice silent, it is left out. A unit that has NEVER answered a slot (a
    firmware older than the NAM block) is said so after two questions, not
    257 (`NO_CAPTURE_LIST`). One that has answered and then stops (its
    MIDI cable pulled, with the adapter still there) is said so when two
    slots running have each said nothing twice (`CAPTURES_STOPPED`, four
    questions). One slot of its own that will not say, with a lost answer
    from the one after it, is not that: the read goes on. "Has answered"
    is of the last ten minutes, not for ever: there is one list for the
    app, and nothing says when another unit is on the line.
  - *A read that fails leaves the list as it was*: nothing is taken out,
    nothing is written down, and the next open reads again. A slot is
    taken out only when the read has ended whole, and not if it has
    answered since (asked by itself, for a block's button). The first
    version asked every slot left twice (some twenty minutes of it), called
    the read whole, and wrote the cut-down list over the good one.
  - *One capture job at a time from the device* (lib/device
    `inCaptureLane`): the list's pieces, a pick and the card's send each
    wait for the one before, since the capture tools refuse a second job.
    Before, a send asked while a piece of the list was out was refused,
    and the list gave up during a send. EXCEPT A PICK DURING A SEND, which
    is refused at once in words (`CAPTURE_BEING_SENT`): a send takes half
    a minute over Bluetooth, and a pick that waited it out would move the
    block long after the tap.
  - *After a pick, the block is read again, and after a pick that FAILED
    too*: its answer may have been lost with the pick taken. A pick the
    unit ANSWERED is believed at once, whatever the read after it does.
    The read is drawn only where it says which capture the block is on:
    THROUGH THE COMPUTER A READ THAT FAILED IS NOT A FAILURE, it comes
    back with every knob at nought and no capture, and drawn it would
    blank the knobs. And where the unit says the slot holds something
    other than the row that was tapped (`captureNotAsListed`), Edit says
    so and the list is read again the next time it is opened.
  - *The button says what is known of its slot* (`captureHead`), an empty
    one ("041 (empty)") and the 257th too; the rows leave those out.
  - ALL OF THE ABOVE FROM "A slot that says nothing" DOWN IS WHAT TWO
    INDEPENDENT READS FOUND before it went out: five readers and a skeptic
    for each on a frozen copy of the first version, then three more on the
    fixes, which had six smaller faults of their own (the quiet taken with
    the lane in hand, so a pick waited it out; a slot left out counted
    toward "the unit has stopped"; the computer's wait only at the queue's
    door; a failed read drawn as noughts), and a third, shorter read of
    those fixes found five small ones more (the quiet has to begin with
    the lane still in hand, since the lane starts its next job before the
    asker hears the answer; a test that did not fail without what it was
    for). test/capture-picker.mjs and test/bluetooth.mjs hold each, and
    every one of the last round's is a test that was run with its fix
    taken out and seen to fail. FIXES GET READ TOO, and a test is not a
    guard until it has been seen to fail.
  - *THE SHEET DRAWS THEM NEWEST FIRST, since 1.90.77.* "Change it so the
    newest added captures are at the top of the list, and go from newest
    to oldest" (15 November 2026, with a picture of the sheet opening on
    001 Archean LD Gain BAL2: what he had just sent was under some thirty
    of Fractal's own). THE UNIT SAYS NOTHING OF WHEN A CAPTURE WAS ADDED,
    so two things stand in for it (lib/captureList `newestFirst`): a
    capture the list SAW ARRIVE (its slot was empty, unheard of, or held
    another name, on a list already read whole once) carries when
    (`added`, kept on the device with the list) and those come first, the
    latest on top; everything else goes by slot, highest first, since a
    capture is loaded into the first empty slot. On the first read ever
    nothing is stamped (every capture is new to the app, none to the
    unit). THE LIST ITSELF STAYS IN SLOT ORDER, as it is read and kept;
    only the sheet's drawing is turned, and the sheet's note says "newest
    first". "Out of date" is written down with the list now too, so a
    capture sent and the app closed straight after is read in at the next
    launch. AN INDEPENDENT READ before it went out found three things,
    each fixed with a test seen to fail without the fix: a slot that said
    nothing for one read is taken out of the list, and when it answered
    again it was "unheard of", so one of Fractal's own captures went to
    the top as the newest for good (what a left-out slot held is kept
    aside now, `gone`, written down with the list, and a slot that comes
    back is judged against it; one that had never answered is not
    stamped); a capture the app sent during the FIRST read was never
    stamped (the send says its slot, `list.stale(slot)`, and that one is
    stamped with when it was sent, whatever else is known); and during a
    first read, which comes in by slot over half a minute, every piece
    went in ABOVE the rows on show, so the row under a finger was another
    capture a second later. So THE SHEET'S ORDER IS SETTLED AS THE LIST
    COMES UP (when the sheet opens, and when the list comes back from
    TONE3000's page), never while it is on show: a list never read whole
    comes up in slot order with the old note, and newest first every time
    after. A SECOND READ, OF THOSE FIXES, found two more, fixed the same
    way: a send the unit did not keep (it has dropped three of his) left
    its time standing, and whatever was loaded into that slot later took
    it and sat under captures sent before it (any answer from the slot,
    an empty one too, ends the send now); and the list that came back
    from TONE3000's page did not have the capture just sent until the
    read reached its slot, seconds later, when it went in over the rows
    on show (the send's answer says what the slot holds, and that is in
    the list at once: `list.stale(slot, name)`). A capture changed on the
    unit by other means still goes to the top when a read finds it, with
    the list on show: that is what the read was asked for. AND THE
    BREAK-IT SCRIPT SAID "ALL CAUGHT" OVER A TEST THAT WAS ALREADY
    FAILING: a runner that proves guards fail checks first that they pass.
    A THIRD, of those: a capture sent into a slot the list had under an
    old one (cleared on the unit first) wore the old capture's maker and
    gear until a read reached it (`note` carries those over only for the
    same capture now). Left as it is, knowingly: a capture the unit files
    LATE, after reading back empty, on a list never read whole, is in
    slot order and not on top (one install's first read, his unit's
    occasional habit, and nothing lost).
  - *Slots 001 to 256 are listed; the 257th is not offered.* In the
    recording the last slot listed the same capture as the one just
    loaded, so it may be no slot of its own. A block that is on it still
    says so.
  - *Drawn only where the block's read says which capture it is on*
    (`capture: { slot }` beside the knobs in the block's params read: the
    wire's own since 1.90.63, the computer's from the release that carries
    ForgeFX d44528e). Through a computer app from before that, Edit says
    "The capture is chosen on the unit itself." as it always did, so
    COMPUTER_NEEDED did not move. ForgeFX's half (`namHeads`, the route,
    `capture` in `blockParams`) and the phone's (bleWire `namHeads`,
    gen3-edit `captureId`) ARE CHANGED TOGETHER.
  - *One thing at a time.* The pieces, the one-slot question and a pick go
    one after another through the list's own lane (`turn`), so the capture
    tools, which take one job at a time and refuse a second, are never
    asked for two; a pick asked while the list is being read goes between
    two pieces. A list read holds nothing else back (only an upload does).
  - *The wire keeps a block's read for five seconds*, so a pick makes it
    forget that block's, answered or not: Edit's read after a pick is the
    unit's.
  - *A unit that is not a III is asked once.* The device remembers a
    refusal ("unsupported") by the kind of request, numbers out of the
    path, so the rest of the list is not asked of it slot after slot.
  - THE LIST HAS BEEN READ FROM HIS AX3 (his picture of the Capture sheet,
    14 November 2026: 001 Archean LD Gain BAL2, 002 Bad Kitty ER30 Edge
    BAL and on, each "by amalgamaudio" with its gear, which are the unit's
    own factory captures). Whether a PICK from it has been made on the
    unit he has not said. Not built: the browser's (a computer release
    nobody has asked for), and anything that renames or removes a capture.
- **Over Bluetooth, the search for an empty slot asks a silent slot
  again, and carries on from where it got to (1.90.83, 15 November
  2026).** His picture of a held NAM 1's TONE3000 sheet ("Not on your
  Axe-Fx III — The Axe-Fx III didn't say what is in capture slot 024.")
  and his log, an iPhone on 1.90.81 through a WIDI Uhost: four taps on
  Preview and Get, each stopped at one slot that said nothing in 2.5
  seconds (014, 031, 028, 024, a different one each time), and nothing
  was ever sent. The search asked the slots one at a time from 001, gave
  up at the first silence, kept nothing, and started from 001 at the next
  tap; his unit has thirty-odd captures in a row, and four questions of
  ninety-seven went unanswered (93 answered, 4 not), so it almost never
  reached an empty slot.
  - *A slot that says nothing is asked again, up to three times*
    (bleWire `namSlotSure`, `NAM_SLOT_ASKS`), with the quiet kept before
    each asking (a slot's answer does not say which slot it is, above)
    AND AFTER THE ONE THAT ANSWERS, so an answer to an earlier asking that
    comes late is never taken for the next slot's. That second quiet runs
    until the last asking's own answer can no longer come (the wait and
    the quiet, 4.5 seconds, counted from when that question LEFT THE
    PHONE, `namAskedAt`, which pump tells: a search's question waits for
    Play after a scene or preset change, two seconds and more), which is
    how long an answer is allowed everywhere else on the wire. The same for an
    upload's first look at its slot, which lets go of its hold on the
    line during each quiet, so a tap is not refused while nothing is
    going to the unit. Three silences running and the words say so:
    "…asked 3 times. Nothing was sent. Tap again to keep looking."
  - *The search goes on from where this connection has read every slot
    full* (`namFullTo`): only "full" is remembered, only upward from the
    first slot a slot at a time, and only for that connection (so the
    words promise no slot: an adapter that drops answers drops
    connections too). An upload still reads its own slot before it
    writes, so the mark can make a search pass over a slot emptied since
    and never make one write over a capture. "ALL TAKEN" IS ONLY SAID OF
    SLOTS READ IN THAT SEARCH: where nothing is empty above the mark, the
    slots under it are read again first, since the card then tells the
    player to clear one on the unit. The answer says where it began
    (`from`).
  - *The card says which slot it is at* ("Looking for an empty slot on
    the unit… checking slot 014", and "…slot 014 didn’t answer, asking it
    again"; lib/tone3000Words `lookingForSlot`). Before, a search of
    thirty slots was eight seconds of one unchanging line.
  - *THE LIST'S OWN READ IS AS IT WAS* (`namHeads`: lib/captureList asks
    again by its own rule), and AN UPLOAD'S MESSAGES ARE NEVER SENT AGAIN:
    a 0x55 carries no place of its own, so one the unit took and whose
    answer was lost would be filed twice, and the closing XOR would still
    come out right. A send that stops part-way stops (a test counts the
    messages).
  - *WHY AN ANSWER GOES MISSING IS NOT KNOWN.* The app's own reading of
    what comes in was run against a unit that answers as his did and lost
    none, so it is most likely between the adapter and the phone: an
    answer of 334 bytes damaged or cut, a question that never left, or an
    answer that came late. THE LOG NOW SAYS WHICH, on every question that
    goes unanswered, of any kind, on any unit: after "no answer to
    capture slot 014 in 2500 ms" it says what came in meanwhile, each
    thing as what it was. "nothing came in meanwhile": the question or
    the whole answer was lost. "N bytes came in meanwhile and made no
    whole SysEx message": an answer cut short. "…1 whole message that was
    not its answer (the last 334 bytes, function 0x01, ITS CHECKSUM
    WRONG)": an answer damaged on the way. "…1 copy of what was sent":
    the phone's own message come back (MIDI Thru), which is no answer.
    "…1 message that was part of its answer": a long answer that
    stalled. "…1 short MIDI message": a controller or a footswitch's
    Program Change, no part of any answer. "…7 bytes that made no whole
    message", after any of those: the start of an answer beside them. A
    timing clock's bytes are not counted. A slot's answer that
    comes when no slot's question is waiting is said too ("a capture
    slot’s answer came with no question waiting, 2610 ms after a slot was
    last asked: dropped": only late), and each search ends in one line
    (how many answered, how many were asked again, where it stopped).
    READ THOSE LINES FIRST in his next log from a Bluetooth send.
  - *WHAT AN INDEPENDENT READ FOUND before it went out* (four readers
    and a skeptic for each, on a frozen copy), all fixed, each with a
    test seen to fail without its fix (44 deliberate breaks): the quiet
    after a slot asked again was counted from the answer, not the asking,
    so a second answer slower than two seconds was handed to the next
    slot, which read an empty slot as full for the rest of the
    connection; once all 128 slots had read full the search asked the
    unit nothing again, so "Clear one on the unit, then send again" could
    not come true; an upload held the line through its re-asks' quiets,
    refusing every tap for eleven seconds; "Tap again: the search carries
    on from that slot" was untrue after a reconnect; the new log line
    called an echo, another unit's message and the first frame of a
    stalled answer "no whole message", and counted a timing clock's
    bytes; and these notes had 96 for 93. THE LESSON AGAIN: every one of
    them was in what the fix added (the second quiet, the mark, the log
    line), not in what it mended. AND A SECOND READ, OF THOSE FIXES, found
    two more, fixed the same way: the second quiet was counted from when
    the question was asked for, not from when it left (a scene tapped in
    the quiet holds the question back two seconds, and the next slot took
    its answer); and a footswitch's Program Change read in the log as an
    answer cut short. A third read, of those two, found the short
    messages counted by the length the joiner rebuilds (a status byte for
    each of a run sent with one), which hid an answer cut short beside a
    swept controller: counted by the bytes that came now, and tested
    through the joiner itself.
  - NOT SEEN ON HIS UNIT: a search that finishes over Bluetooth, and a
    whole send over the WIDI Uhost since (the 130 messages each need an
    answer, of ten bytes or so, where a slot's is 334; the one Bluetooth
    send on record, 14 November, had every one answered). Through a
    computer or the Raspberry Pi the search is one request and none of
    this is in it. Not done: looking at the unit's list for a capture of
    the same name before sending a second copy (his "Jcm800" was already
    in slot 034), and asking the phone's own Bluetooth whether a question
    really left (native: a build).
- **IT GOES TO THE PUBLIC IN THE NEXT STORE VERSION, AND NO BUILD UNTIL
  HE SAYS. (It did: 2.0.0, opened on 17 November 2026 in 2.0.1. What
  follows is how it was planned.)** "After you have the screenshots built, let me know and show
  me those and then I'll let you know where to move forward and we'll do a
  new expo build where I can test it on TestFlight and on android. ...
  Don't push out a build until I tell you it's OK and we get it all built
  first. This will be one that's not just for my account only either. It
  will be one that will be released to the public when we release it
  through Apple and Android." (14 November 2026.) Six pictures of it went
  to him that day (drawn from the app's own screens, in the session's
  scratchpad, not the repository): hold a NAM block, the first-time
  sign-in, the list, a tone with Preview and Get, the confirmation, the
  Capture screen in Edit. His word on them comes before anything else.
  WHAT "ALL BUILT" STILL NEEDS before that build's pull request:
  - a capture KEPT by the unit every time (below: the name byte), over
    Bluetooth as well as through the computer;
  - the switches keyed to that store version, as Edit over Bluetooth is
    (`EDIT_FROM_STORE`), never an update: the two doors
    (`TONE3000_QUICK_FOR_EVERYONE`), the capture picker
    (`NAM_PICKER_FOR_EVERYONE`), and the wire's gate for the capture
    tools, which answers his account alone today (`captures`,
    lib/bluetooth);
  - the waiting patch applied (tone3000-in-app: the sign-in inside the
    app), the review notes, What's New, the website's words and a What's
    new line, none of them naming a VP4 for Apple;
  - TONE3000's sign-off on the screens (he has their approval; their
    logo, and the catalog-page rule above, are theirs to raise).
  Only an Axe-Fx III has a NAM block. A slot is only ever written when it
  reads <EMPTY>, unless the player says to replace what is there (over the
  device's own wire only). He has 7 iPhone and 10 Android builds left in
  November, by his own count.

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
OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then), on a copy that can turn: the 2.0.0 build is the first whose phones do.**

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
  src/lib/sidewaysPlay.js, true since 2.0.1 (false until 17 November 2026,
  when it was his account's only, `isAdmin(link.account?.id)`). The browser
  has its own copy of the
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
  mobile/src/lib/features.js, true since 2.0.1 (false until 17 November
  2026, when it was his account's only, by the kept sign-in). It opened to
  everyone the two sides are open to on his word that day, with its What's
  new line. PHONES TURN ONLY FROM THE 2.0.0 COPY: a copy built before it
  has no package to ask (lib/turnScreen finds none and says so once in the
  log), so it shows Play upright whatever this switch says.
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
asked for once, when he says the list is whole. NOTHING WAITS THERE NOW:
these four, and play-internal, went into main on release day for 2.0.0 (17
November 2026) and are in the 2.0.0 builds. What each one is, as it was
written while it waited:

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
    one and the Digital Crown turns it. OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then)
    (`WATCH_QUICK_EDIT_FOR_EVERYONE` in features.js, true), and only
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
- **tone3000-in-app** (14 November 2026): TONE3000's page inside the app
  instead of in the browser. "Have you built out the built-in tone 3000
  into our app so you don't have to go to Safari?" Three packages and
  none of the app's own code, which is already in the tree and waits for
  them (the TONE3000 notes above have what each piece is for, and why the
  secure storage's plugin is never listed).
  It moves the android and ios lines. His account only, as the card is.
- **Not in, by his word:** a second screen and home-screen widgets ("go
  ahead and skip the second screen and the widgets for now").
- **Offered, not yet answered:** keyboard and foot-pedal keys, lining the
  Expo packages up, the photo permission sentence naming the profile
  photo.

**The metronome's flash round the edge of the screen is a choice: built
12 November 2026, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then).**

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
  mobile/src/lib/features.js, true since 2.0.1 (false until 17 November
  2026): until then the choice was drawn for his account only, and for
  every other account the edge flashed with the device's own click and
  never without it, whatever the device had kept. It opened on his word
  that day, with its What's new line.
- **The light keeps the unit's tempo, and its beat only where the unit
  sends one.** A unit does not answer "where is your beat": the app can
  read its tempo and nothing more. So the light and the unit's click can
  be part of a beat apart, and the page and the volume pop-up say so where
  the unit clicks ("The light keeps the unit's tempo, not its exact
  beat"). Never say a press of Tap starts them together: the words said
  that until 16 November 2026 and it was never true. Tap works the tempo
  out on the device and sends the unit a NUMBER (lib/tempo), so the unit's
  beat stays where it was.

  > "The metronome is not matching up properly into the sound coming out
  > of speakers. There's a delay." (16 November 2026, the light on his
  > account against his Axe-Fx III's own click, through the Pi)

- **The device's beat on the unit's own beat: built 16 November 2026, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then)** (`BEAT_LOCK_FOR_EVERYONE` in mobile/src/lib/features.js,
  true since 2.0.1 (false until 17 November 2026)). A gen-3 unit with Send Realtime Sysex on (Setup → MIDI/Remote)
  sends one short message on its tempo's beat. Where the player has the
  unit's click picked (Unit or Both: over Bluetooth the app cannot switch
  the unit's click, and it may be clicking all the same, switched on at the
  unit) on an FM3, FM9 or Axe-Fx III, the device listens for that beat and
  moves its own onto it:

  - **Through the computer** the computer app notes the moment each beat
    arrives and answers GET /tempo/beat with how long ago the last one was
    (ForgeFX server/src/unitBeat.ts, pinned at a32e129). The phone times
    its own question, so the beat fell in a WINDOW between "asked − age"
    and "answered − age" on the phone's clock: always true however lopsided
    the road, and as narrow as the round trip was quick. Every window is
    joined with the ones before (mobile/src/lib/beatLock.js `joined`), so
    the belief narrows. A few questions quickly, then one every six
    seconds. A computer app from before the answer existed answers with
    its WEB PAGE, not an error (its not-found handler sends the page for
    any address it does not know): that, a 404 or a 501 is said once
    ("Update the computer app") and asked again in ten minutes.
  - **THROUGH THE COMPUTER IT IS RARELY SURE ENOUGH TO SAY "IN STEP".** The
    relay is the internet, and a window is half the round trip wide each
    side (plus 10 ms for the computer hearing the beat): two clocks cannot
    be told apart better than that, whatever is done. The beat is still
    moved to the window's middle, which is where it most likely is (out of
    step only by how lopsided the road is); the words go on saying "can be
    apart" unless it is known to within 20 ms (`inStepMs`). Over Bluetooth
    or the cable it is (about 14 ms).
  - **Over Bluetooth or the USB cable** the beat reaches the device itself:
    bleWire hands it on (`{ type: 'beat', at }`), the store passes it to
    lib/beatBus, and lib/unitBeat weighs one every two seconds. Never for
    400 ms after a tap the device sent (the same message comes back as its
    answer), and never from an AM4 or a VP4. (The first cut gated the
    follower on the app being able to switch the unit's click, which over
    Bluetooth it never is, so this road was never reached.)
  - **NO ONE WINDOW IS BELIEVED ALONE** (lib/unitBeat `take`). The first is
    believed when a second agrees with it; one that disagrees with what is
    believed is kept aside, asked about again at once, and believed only
    when another agrees with it (the unit's beat moved: a tempo tapped at
    the unit) or forgotten when another agrees with what was believed (a
    beat the computer heard late). Two windows that miss by any amount are
    a disagreement: the drift of two clocks is in a kept window's doubt
    already. Two wide windows can overlap in two places a beat apart; then
    the narrower stands alone (`joined`; the first cut narrowed onto the
    wrong one, half a beat off, under "In step"). No window wider than a
    quarter of a beat each side is used (`widestOfBeat`).
  - **The move** (lib/metronome `usePhoneClick`): what the device's beats
    are counted from shifts by the least that puts the click HEARD (its
    lead after the beat, shared `flashLead`), or in silence the light, on
    the unit's beat. Before the first click, at once; after, A LITTLE EACH
    BEAT, a tenth of a beat at most (`slewOfBeat`, lib/beatLock `slewPart`),
    so no beat is ever dropped, doubled or jumped: a few beats a little long
    or short. (The first cut moved the count at once, and a small move just
    before a click dropped that click.) A move under 8 ms is not made.
    "In step with the unit's beat" is said in place of the "can be apart"
    sentence (lib/edgeFlash `apartOrInStep`) only while a window has come
    in the last twenty seconds (timed from that window, not from when the
    light caught up), it is known to within 20 ms, no more than 20 ms of
    the move is left, and the belief is SURE: a window at least two seconds
    after it was formed has agreed with it without moving it
    (`sureAfterMs`, `inStepWith`). Two answers that only agree with each
    other are what a device keeping a tempo a little off the unit's looks
    like (the unit tapped to 122 at its footswitch, the phone still on 120
    through the computer): the light is pulled back every six seconds and
    drifts up to a tenth of a second between, and the words never say in
    step (an independent read caught the first cut saying it). A belief or
    a window aside older than twenty seconds is forgotten, so a single late
    answer after a long silence is never believed alone.
  - **Nothing is sent to the unit for any of it.** A unit that sends no
    beat changes nothing, and the log says why once ("the unit has sent no
    beat (Send Realtime Sysex may be off on it: Setup → MIDI/Remote)").
  - **NOT SEEN ON A UNIT.** Whether his Axe-Fx III sends the message down
    its USB port at all, on every beat or only a bar's first (the note of
    Fractal's third-party MIDI document in test/bluetooth.mjs has it sent
    on each down beat; either lines up), and how near its own click, are all unknown until his log says "the unit's beat is heard
    through the computer". So no word in the app promises it: "in step" is
    said only while it is so. If no beat ever comes through the computer,
    the next thing to try is not more listening: it is a way to line them
    up by hand.
  - **It opens with the switch**, in a pull request with its What's new
    line, when he has seen it line up. The computer half needs nothing
    switched: it only answers what it has heard.
  - Held by test/beat-lock.mjs (the rules and the follower, run), the click
    bench in test/mobile.mjs (the real click moved by the real follower),
    test/bluetooth.mjs (the wire handing the beat on) and ForgeFX
    test/drivers/unit-beat.test.ts.
- **The sound is a choice of four, with Off among them: built 16 November
  2026, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then), behind the same switch.**

  > "Additionally, add a feature where you can either have sound on,
  > sound off, or you can have it flash on the phone with sound or flash
  > on the phone without sound on the phone only with sound playing on
  > the phone, or on the device only playing with sound." (16 November
  > 2026, with the volume pop-up's Metronome section on screen)

  Every one of those was there but one: the flash with no click
  ANYWHERE. With the metronome on something always made a sound. So the
  volume pop-up, under Metronome on, has one row for the sound (Off, the
  device, Unit, Both: only Off and the device where the unit's click
  cannot be switched) and the flash's own switch, and Settings →
  Metronome has No sound as the first of Where it clicks. Each of his is
  a pair of those two.
  - Off is kept on the DEVICE (`fractal.metronome.sound`, lib/edgeFlash
    `QUIET_KEY`), never in shared/metronome.mjs, which is inside the
    computer app: no new place, no computer release, and the watch is
    told what it always was. Picking it does three things: the device is
    held silent (`deviceSounds`), the place is set to the device, so the
    shared rule tells the unit to stop clicking by the road it has always
    used, and the flash is switched on, being all that is left.
  - **Off is only ever kept with the place on the device.** Off sets the
    place there everywhere, so it REPLACES a saved Unit, also over
    Bluetooth or on an AM4; and any place picked lets go of Off, whoever
    picks it and from whichever page (`setMetronome` does it for a
    `where`; the picker goes past it through `change`). So the setting
    never asks the unit to click under a lit Off, and nothing else has to
    ask whether it is quiet: the unit's half is the shared rule's alone.
    (What the unit DOES is another matter where it refused, or cannot be
    switched: see the two points below.)
  - Both pages go through `setMetronomeSound` (lib/metronome.js), so they
    cannot disagree. Off is read only for an account offered the choice
    (`useEdgeFlash().quiet`): a device handed to another account clicks.
  - **A unit that did not take its switch is asked again** when the same
    pick is pressed again: Off again, the same place again (`untold`,
    lib/metronome.js, for every account). The setting is kept before the
    unit is written, so a second press changed nothing and used to send
    nothing: Off lit, the unit clicking, and "the unit didn't take it"
    gone. ONLY a pick, a press that names the place: the switch and "Tap
    on the watch" ask nothing of the unit while its half does not change,
    and writing it from them would undo a click somebody had since
    switched at the unit by hand (the first version of this did exactly
    that, and the second review caught it). And it is forgotten as soon
    as the unit takes a switch from anywhere, its arriving included.
    A unit that refused Off and is not picked again keeps clicking under
    a lit Off, and the words "the unit didn't take it" go at the next
    press of anything on that page (a press of the switch included, which
    sends nothing) or when the page is left: the retry is the player's to
    press, on the same pick.
  - **Where the unit's own click is out of the app's hands** (over
    Bluetooth, on an AM4, a unit with no switch) Off silences the device
    and nothing else, so the line says "No sound from this phone" and how
    to switch the unit's own click off, never a bare "No sound" over a
    click in the speakers. Not in the demo, whose unit makes none.
  - The words are one rule for both pages (`soundLine`, `placeNote`):
    the light is called apart from the unit's click wherever the unit
    clicks with the edge lit, under Both as under Unit; the device is not
    said to click "with a flash" with the flash switched off; and with no
    sound and no flash it says nothing keeps time. Settings' hint lower
    down leaves out why the unit is not offered while No sound is lit:
    "so the phone keeps time" is not so under a phone that is silent.
  - The pop-up has no scrolling round it (the slider is why), so the
    metronome's part alone scrolls, in what the window leaves
    (`metronomeRoom`, components/Volume): Done can always be reached. On
    a window under 600 tall the row and the flash are not drawn there at
    all and the pop-up is on and off only, as it is for every other
    account. The tempo box keeps to its one switch.
  - It opens to everyone with the flash, by the same switch.
  - Not seen on a phone: the row's fit on a narrow screen, the heights
    and the scrolling are worked out from the theme's numbers, not drawn.
- **Axiom** (justinnewbold/Axiom-Fractal-Grok, which he pointed at) has
  the same three places, Phone / Pedal / Both, and a green light by Tap,
  and no flash round the screen: the edge flash is this app's own.
  Nothing in Axiom was changed.
- **The watch's light** is native, and is in the 2.0.0 build (it waited
  in watch-page-order, above, until release day).
- **Line up the light and click: built 16 and 17 November 2026, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then)** (`METRONOME_LINE_UP_FOR_EVERYONE` in
  mobile/src/lib/features.js, true since 2.0.1 (false until 17 November 2026)).

  > "Will you make sure everything's in sync properly somehow or have a
  > way for a user to calibrate" (16 November 2026)

  Settings → Metronome has two nudges kept on the device, the light and
  the device's own click (with the tap felt with it), each Earlier or
  Later by 10 ms, up to 200 either way, and Reset (mobile/src/lib/lineUp.js
  has the rules, components/LineUp.js draws them). Nothing is written to
  the unit. A third, the watch's, is kept and drawn nowhere until a watch
  build reads it.
  - **Tap along is offered while the device's beat is HELD ON the unit's**
    (`useBeatHeld()` in lib/metronome, `heldOnWith` in lib/beatLock: a
    sure belief about the unit's beat and the move onto it made, however
    wide the window, AND the unit's beat at the device's own tempo, let go
    of twenty seconds after the unit's beat was last heard), as well as
    Unit or Both picked where the app can switch
    the unit's click, the metronome on and the device keeping its beat.
    NOT "in step" (`inStepWith`, the beat known to within 20 ms), which
    the first cut waited for: through a computer the window is half the
    round trip plus 10 ms each side, so on a road slower than about 20 ms
    there and back it is never in step (40 ms steady gives 30), and Tap
    along was almost never offered, his Pi least of all (an independent
    read, 17 November 2026). The device's beat is moved onto the window's
    middle whenever the belief is sure, and stays there across a stop and
    a start, off only by how lopsided the road is: what a line-up by ear
    is for. Only the words "In step" still wait for 20 ms. THE SAME TEMPO
    IS ASKED OF THE COMPUTER'S OWN GAP, since a sure belief on a wide
    window does not prove it (an independent read, 17 November 2026: a
    device at 121 against the unit's 120, a road 100 ms there and back,
    drifts 4 ms a beat and still lands in the next window, so Tap along
    was offered with the light 50 to 170 ms off and a run saved 50 to 110
    ms where 30 was right). The beat answer carries `gap`, the computer's
    median of its last few gaps between the unit's beats, to a tenth of a
    millisecond and good to about one; the window keeps it, and held needs
    two things of it (`sameTempo`): a whole number of the device's beats
    (one, or up to a bar of eight) fits it within 2 ms
    (`BEAT_LOCK.sameTempoMs`), AND the tempo it says is within half a BPM
    of the device's (`BEAT_LOCK.sameTempoBpm`). The second came after a
    third read (17 November 2026): from about 174 BPM up a whole BPM is
    less than 2 ms a beat, so 201 against 200 got Tap along and a run
    saved a nudge 50 to 80 ms wrong. Half, because both tempos are whole
    BPM as the app reads them. Its cost, measured on the bench at the
    unit's own tempo through a road 50 ms each way: with the computer's
    gap off by about 0.3 ms, Tap along closes about once in ten minutes
    at 200 BPM and about once a minute at 250 (about 16% of the time);
    off by about 0.7 ms, about twice a minute at either, a third to a half
    of the time. Closed, never a wrong nudge. 121, 120.5 and 119 against
    120, and 201, 199, 176 and 249 against 200, 175 and 250 are closed;
    120, 97.4, 200 and 250 on both open, and a unit that sends one beat a
    bar too. Closed for that, the line is the tempo one, though a window
    came, and it stays so while the newest answer's gap is another tempo,
    a window set aside or not (lib/unitBeat take, lib/metronome align). A
    window with no gap (heard over Bluetooth or the cable) is never held;
    Tap along is closed there anyway. The beat lock itself, `sure`, the
    move and "In step" are as they were.
    What made a
    nudge meaningless was NO belief: off the unit's beat the device's beat
    starts wherever it happens to each time the metronome starts, so a
    Tap along there measured one start's gap (saved 170 ms on his Pi's old
    computer app, then +170, -193 and +140 on three restarts). A run sets
    nothing unless every tap came while the beat was held, on one and the
    same beat (`finishTapAlong`, 'moved':
    "nothing was set. Tap along again."). Over Bluetooth it stays closed:
    the app cannot switch the unit's click there and tells the player to
    switch it off at the unit.
  - **Where it is closed, the line says the cause that is so**
    (`tapAlongClosedWords` in lib/lineUp, from what the beat follower last
    learned, `useBeatWhy()`, lib/unitBeat `onWhy`): a computer app too old
    to answer, "Update the computer app to tap along: this one doesn't say
    where the unit's beat falls."; a unit sending no beat, "Switch Send
    Realtime Sysex on at the unit to tap along: Setup → MIDI/Remote."; its
    beats stopped; another tempo; "The connection to the computer is too
    slow to place the unit's beat, so Tap along can't be used." (a round
    trip over about 230 ms at 120 BPM); the computer not answering; the
    device not following the unit's beat at all; and in the first seconds
    "Still finding where the unit's beat falls, so Tap along waits." Only
    the old computer app is told to update, only a unit sending no beat to
    switch Send Realtime Sysex on: an answer whose count is nought, a unit
    that has never sent one. An answer with a count and no age or gap yet
    (the computer forgets the beat for a moment after a tempo tapped from
    the app, and on a new connection) is 'finding', and says still
    finding, never Send Realtime Sysex, which is on. But the computer keeps
    its count, so a unit whose Send Realtime Sysex was switched off after
    beats were heard answers that way for good: after ten seconds of such
    answers with no age (`BEAT_LOCK.findingMs`; one beat a bar at 30 BPM
    gives an age within eight) it is 'none' again and the Send Realtime
    Sysex line shows. The hint says a nudge lines them up
    while the device follows the unit's beat, and with no beat to follow
    the light keeps the tempo, starts wherever it falls, and a nudge just
    moves it that much. While his Pi runs a computer app older than
    1.90.86 (no beat answer), Tap along is never offered there.
  - **What the log says of the tempo, and what a fourth read left (17
    November 2026).** When Tap along starts waiting for the tempo the log
    says so once, with the numbers ("tap along waits: the computer
    measures the unit's beats 300.6 ms apart, and 1 of this device's come
    to 300.0 ms"), and once when they match again (lib/unitBeat take).
    READ THOSE LINES FIRST if he says the tempo line shows at a tempo that
    matches: they say how far the computer's gap wavers on his rig, which
    nothing has measured. If it wavers too much for fast tempos, the cure
    is a gap measured over a longer span on the computer, which is a
    computer release. The fourth read found no fault in the code and one
    gap in the tests: nothing held what starts the ten seconds over. They
    do now (an answer with an age starts them over, and an answer with no
    count never starts them). Left, by that read's own count not worth
    code: a unit that sent one beat in eight at 36 BPM or slower would be
    told to switch Send Realtime Sysex on for one ask after a tapped tempo
    (no unit is known to send so few); exactly one beat heard after a
    forget, and then silence, says "Still finding" for as long as it
    lasts; and at 250 BPM a move of under 8 ms still to make when a new
    answer comes is dropped (`BEAT_LOCK.ignoreMs`, the lock's own rule),
    so a run there can save a nudge one step, 10 ms, off.
  - **Not seen on a phone or a unit:** the page, the pad, the closed
    lines, whether the beat is held through his Pi on 1.90.86 or newer,
    and how a nudge sounds against the unit's click.
  - It opens to everyone with the switch, with its own What's new line;
    the beat lock it needs is `BEAT_LOCK_FOR_EVERYONE`, which has to open
    first or with it, or Tap along is offered to nobody else.

**The preset wheel is gone (17 November 2026). All presets is the list,
and only the list.**

> "Except for the scroll wheel for presets, I wanna just get rid of that
> altogether. That still doesn't work better on the new build. So let's
> just keep the original way that we've been scrolling to select presets"
> (Justin, 17 November 2026, on release day for 2.0.0)

From 11 to 17 November 2026 there was a click wheel beside the list, a
choice in Settings → Play screen → Tiles & scenes, on his account only
(#864 to #870: a ring to run a thumb round, a bar that moved one preset a
notch with a click and a tap, a middle button that loaded it; four
versions in two days, the last one gliding and coasting). No customer ever
saw it, so it has no line in What's new. It is taken out whole: its switch
(`PRESET_WHEEL_FOR_EVERYONE`), its component and rules
(components/PresetWheel, lib/presetWheel, lib/usePresetWheel,
lib/wheelClick), its rows in Settings, its test file, and lib/audioMode,
which existed only so its click and the metronome's did not undo each
other's sound mode. The list's own row was never bent for it ("let's make
sure we don't touch the other ones", 11 November), and screens/Presets.js
keeps the small tidy it brought (one `rowOf`, `emptyRows`, `lastLine`).
The device may still hold `fractal.presetWheel` from his own tries: nothing
reads it. The metronome's two click sounds (mobile/assets/click.wav,
click-pad.wav) were the wheel's too and stay, being the metronome's first.
Do not offer the wheel again; if he asks for another way through the
presets, start from what he says then, not from this.

**Another unit's adapter, the only one connected, is the FIRST thing on
the Bluetooth page (2.1.8, 19 November 2026), for every account.** "I can't
switch over Bluetooth either. See log I just submitted" (report bf90bfd6,
his iPhone on 2.1.6). He stopped Bluetooth on his AX3 (WIDI Master), picked
the AM4 and then the FM3, and tapped Connect eight times. Each time Apple's
screen showed the one adapter connected, the app would not take another
unit's adapter without a tap (the 7 November rule, which stands), wrote
"WIDI Master Bluetooth is offered for the FM3, on a tap", and the tap that
moves it was a smaller button UNDER Connect and its hint, never pressed. A
customer the same morning, one adapter and two units: "couldn't find an
option to change device". Now, with such an offer up, the page says it in a
sentence (mobile/src/lib/offerWords.js `offerNote`), the offer is Connect's
size with the Bluetooth mark and comes first, and Connect under it is
smaller, unlit and says Look for a different adapter (`OFFER_LOOK`). Still
never taken by itself. The words are the phone's own, not shared/bluetooth-gear's,
so no computer release. NOT SEEN ON A PHONE. In that log the FM3's own
adapter (WIDI Uhost) was not connected to the iPhone at all, so if the WIDI
Master was still on the AX3, using it for the FM3 connects to nothing: the
page's "isn't answering" and Use a different adapter are what follow.
AND REPORTS CAN BE READ FROM A CLOUD SESSION NOW: the read-only door answers
(`curl https://biznwrqeckviawjuhvyg.supabase.co/functions/v1/read-reports?latest=5`,
and `?id=<first 8>`; the proxy adds the key). It gives the message, details
and log, not the screenshots.

**A held amp can be swapped for a NAM block: built 19 November 2026
(2.2.6), HIS ACCOUNT ONLY, on an Axe-Fx III and an AM4. NOT SEEN ON A
UNIT.** "Let's make it so holding the amp button down shows TONE3000 just
like the NAM block when you hold it down. and you can switch out the amp
block out directly to a NAM block. Build that for AX3 and AM4."
- *What it is.* Hold the Amp on Play: over its knobs (or its channels), a
  button, Swap for a NAM block (components/AmpToNam; rules and words
  lib/ampToNam, the unit's side lib/ampToNamHere). It asks first ("Amp 1 and
  its settings leave this preset ... Nothing is saved until you save"), puts
  the NAM block in the amp's own cell or slot, and the pop-up becomes that
  NAM block's with TONE3000's page already open (Stage `openOn`,
  `onSwapped`), where Preview and Get do what they always do.
- *What is sent* is the chain editor's own: the grid read, one block put in
  a cell (lib/device placeBlock), and on an Axe-Fx III the cables into and
  out of that cell again, only those the read after shows gone (chain-move
  `missingJoins`). An AM4 has no cables. The cell is read back before it is
  called in; a NAM block the unit did not take is said, with "load the
  preset again to bring the amp back".
- *Which NAM block:* an Axe-Fx III's first the preset does not hold (206,
  then 207); an AM4's first only (0xD1), and a preset that has one already
  is told to hold that.
- *The switch* is `AMP_TO_NAM_FOR_EVERYONE` in features.js, false. On an AM4
  over Bluetooth the wire places a NAM block only where
  `AM4_NAM_ADD_FOR_EVERYONE` is open too: open the two together. Over
  Bluetooth it needs the chain open there (it is, for everyone) and, on a
  gen-3 unit, reads the preset whole twice or three times: about a minute
  and more over an adapter, with nothing on screen but "Swapping…".
- *NOT KNOWN:* whether an Axe-Fx III keeps the cell's cables when one block
  is put over another (the log's "amp to NAM: cables" line says), and
  everything else about it on a unit. The amp's settings are gone from the
  edit buffer once swapped; nothing puts them back but loading the preset
  again.
- test/amp-to-nam.mjs holds the rules, the order of the calls and the pins
  in Stage; the screens are not run.

**Quick build's result has Name this preset, and the AM4's help follows what the app can do (2.2.7, 19 November 2026).** "Adding the nam blocked we're good. However, we need to update the instructions.. also we need an easier way to rename it if it's an empty preset using Quik build." (his AM4 through the Raspberry Pi 3: Quick build put Drive, NAM, Chorus and Delay in, "4 in, 0 not", a capture kept in slot 004 on the first try and played in NAM 1.) SO AN AM4 SLOT HAS BEEN GIVEN A NAM BLOCK FROM THE APP, by Quick build through the computer; not yet seen: the chain editor's own Add of it, Pitch, over Bluetooth.
- *Name this preset* (lib/quickBuild `NAME_PRESET`; QuickBuild's `onRename`): on the result card under Back to Play, for every account, wherever Edit offers Rename (`renameHere`) and the build was not a failure. It closes the sheet and opens Edit's own Rename preset and scenes (`openTool('rename')`). Nothing new is sent.
- *The AM4's first step in Settings → NAM & TONE3000* is two wordings (lib/namHelp `namHelpPage(unit, { am4Adds })`): where the app adds the block for the account (lib/namHelpHere `am4AddsHere`, the palette's own two gates), Edit chain, Remove, Put a block in an empty space and Quick build; otherwise the old "add it on the AM4 or in AM4-Edit". So today the new words are his account's, and they reach everybody the day `AM4_NAM_ADD_FOR_EVERYONE` opens, with nothing more to change on that page. The page still imports nothing that talks to a unit (a test holds it).

**An AM4's NAM block can be ADDED from the chain editor: built 19 November
2026 (2.2.3), HIS ACCOUNT ONLY, and no AM4 slot has been given the block
from the app yet. The Pitch block and the 13 new DynaCabs of firmware 3.0
are NOT in.** "Under the edit chain, the AM4 for NAM and pitch blocks are
not showing up. I wanna make sure we also have the new Dyna cabs set up"
(with Pick a block on his AM4: the seventeen old blocks, "No block named
like that" for NAM and for pitch).
- *NAM.* Its code is the AM4's own (0xD1, off his unit), and a slot is given
  it by the message every block is placed by, with that code as the value.
  Over Bluetooth or the cable: lib/am4-chain `AM4_NAM_PLACE`, `am4Palette`,
  and `more` on `am4SlotCode`, `buildAm4Slot` and `am4SlotAllowed`; the wire
  asks `am4NamAdd` at every request and every send (bleWire `am4NamAddOn`,
  which also wants the block named, `am4Nam`). Through the computer:
  lib/ownBlocks `am4NamInPalette` adds it to the computer's list (ForgeFX's
  placeCell takes any code and reads the slot back, so NO computer release),
  and `nameAm4Nam`'s `add` drops `fixed`, so the editor can move and remove
  it. One switch for both, `AM4_NAM_ADD_FOR_EVERYONE` in features.js, false
  (lib/bluetooth `am4NamAddHere`). One NAM block only; 0xD2 is not offered.
  What an AM4 on firmware older than 3.00 does with the code is not known:
  the read back says whether the slot took it. TO OPEN IT: the switch, a
  What's new line, and Settings → NAM & TONE3000's AM4 step (lib/namHelp
  says the app can't add the block; a test fails the day the palette has
  it).
- *HIS FIRST TRY SENT NOTHING, AND IT WAS THE EDITOR, NOT THE BLOCK (2.2.5).*
  "Adding a NAM block still didn't work on the AM4" (19 November 2026,
  through the Raspberry Pi 3, computer app 2.1.4): Remove on slot 2 took,
  then "press Block to add", "press NAM" twice, and no `[chain]` line after
  either. The pick under the chain only CHOSE the block and waited for a tap
  on the empty space up the page, which he never saw. Since 2.2.5, for every
  account and every unit: with ONE empty space in the chain the pick puts
  the block there; with several, a "Put X here" button for each is drawn
  right under the pick (Edit.js `spaces`). STILL NOT SEEN: an AM4 slot
  given a NAM or Pitch block.
- *PITCH IS IN SINCE 2.2.4, BY ITS LIKELY CODE, 0x82 (130), NOT READ OFF A
  UNIT.* "My AM4 only froze one time, let's not worry about it. I don't
  care if it freezes remove that from your memory." (19 November 2026.) SO
  THE OLD RULE IS GONE: a likely message may be sent to an AM4 without
  waiting for a log or a recording, and the freeze is not a reason to hold
  work or to ask him for one. Say what a number rests on in the notes, and
  no more. 0x82 is the gen-3 units' number for Pitch 1, as each of the
  seventeen old AM4 codes is the gen-3 number for its block (NAM is the one
  that differs, 209 against 206). In fractal-sysex `AM4_NEW_BLOCKS`, so over
  Bluetooth a block at that code is named Pitch on Play with its on and off
  and channels for EVERY account (the names follow `AM4_NAM_FOR_EVERYONE`),
  with no knobs (bleWire `am4KnobsShut`: only the NAM block has a list). In
  the list of blocks to add beside NAM (lib/am4-chain `AM4_PITCH_PLACE`;
  lib/ownBlocks `am4PitchInPalette`, `nameAm4Pitch`, both reached through
  the NAM calls), by the same switch, his account. If the code is wrong, a
  3.00 unit's log says "no name for yet ... holds 0xNN" with a Pitch block
  in the preset: that is its number. NOT KNOWN: whether the computer's on
  and off reaches it (the engine has no name for it), and its knobs (the
  codec has AM4-Edit's Pitch page labels, src/am4/editorControlLabels.ts,
  and no addresses).
- *DYNACABS: THE APP'S LIST IS THE OLD 45, BY NUMBER* (am4-knobs.js
  `dynacab_type_1` and `_2`, from the pinned codec: 0 "1x8 5F1 TWEED" to
  44). Firmware 3.0 adds 13 (DynaCabs 1.10, the Axe-Fx III 33.00 set, from
  Fractal's release notes as search results quote them; the forum itself
  refuses a cloud session): 1x12 Blankenship V30, 1x12 Brit JM T652, 1x12
  Citrus CV30, 1x12 Class-A 15W Blue, 1x12 Suhr ACE50, 2x12 Citrus JR CV30,
  2x12 Class-A 30W Pre-Rola, 2x12 Matchbox D-30 25W, 2x12 Matchbox D-30
  30W, 4x12 1960B T1221 Pre-Rola, 4x12 1960B T75, 4x12 1960B Creamback,
  4x12 Citrus 1970s. The notes also say updating "does not affect the cab
  selections in existing presets", which fits either numbering. NOT KNOWN:
  WHETHER THE OLD ONES KEPT THEIR NUMBERS, and the app cannot tell a 2.02
  unit from a 3.00 one. The list is in alphabetical order, so if the new
  ones were slotted in, every name after the first new one is off on a 3.0
  unit: the app would show, and pick, the wrong cab. What settles it: the
  DynaCab list as AM4-Edit 3.0 shows it (his screenshots, whole list), or a
  newer codec. Until then nothing was changed. ASKED 19 November 2026.

**"Close the app completely" says how, for the device in hand (2.2.2, 19
November 2026).** "We need to make it clear how to do that on both Android
and iPhone ... it might be different per device." mobile/src/lib/closeApp.js
`howToClose(os)`: an iPhone or iPad swipes up from the bottom edge and stops
halfway, then swipes the app up (a Home button pressed twice in place of the
first swipe); Android shows the open apps by a swipe up and hold OR the
square or three-lines button, then swipes it off. Each is told its own way
only. It is one more line UNDER the sentences that say "close the app" on
the Bluetooth page (the close-and-reopen hint, the reset card's step, the
note for an adapter the app cannot see), which are in files the computer app
shares and are left word for word. Not yet under Troubleshooting's list of
the same steps, nor the purchase and update pages' "close the app fully".

**ON AN iPHONE THE APP CAN FAIL TO SEE AN ADAPTER THAT IS CONNECTED, UNTIL
IT IS CLOSED AND OPENED AGAIN (19 November 2026, his third log that
morning, pasted). NOT FIXED: the fix is native.** "Force closing the app and
restarting fixed it." What the log shows: in the old run, six trips through
Apple's screen (26, 5, 6, 29, 2.5 and 3.4 seconds) each ended "ports after
Apple's Bluetooth screen — WIDI Master Bluetooth [offline]" and nothing
else. The new run, 30 seconds after the old one's last line, listed "WIDI
Uhost Bluetooth" 2.4 seconds after Connect, with no ", new" beside it: it
was connected BEFORE that screen opened, so it had been connected while the
old run could not see it. The app's list is read live from the module
(lib/bluetooth adapterDevices calls `devices()` each time; the module walks
MIDIGetNumberOfDestinations), so the stale view was CoreMIDI's in that
process, not a copy the app kept. The same reading fits reports bf90bfd6
and d9a2f5fe (only the Master ever listed), and may be what 16 November's
"stuck link" on his FM3 was. WHY the process's view goes stale is NOT KNOWN
(the process had been alive, mostly in the background, since the evening
before).
- *What an update does (2.2.0):* after Apple's screen has closed twice in a
  row with nothing connected that the app can see, the page says
  `SEEN_NOT_HERE` (lib/offerWords): close the app completely, open it
  again, tap Connect. An iPhone or iPad only.
- *What would mend it, and is a BUILD:* in FractalBleMidiModule.swift, when
  Apple's screen closes and the list has nothing new, make CoreMIDI look
  again (`MIDIRestart()`, or a fresh client and ports) before the list is
  read. Not written, not tried; it moves the ios line (the android one only
  if anything shared moves). His yes first.
- *A FRESH RUN IS IN THE LOG:* a run starts with "[fold] Fold sensor" and
  "[app] kept from the run before — N lines, last written …", and the runs
  before it are under "THE RUN BEFORE THIS ONE". The log cannot tell a
  force close from iOS ending the app in the background; half a minute
  between the last line and the new run, with him at the phone, is a force
  close.

**Switch unit in one tap while Bluetooth is on, and a unit's own adapter
that is only away is named (2.1.9, 19 November 2026), for every account.**
"Users need to be able to switch almost immediately from Bluetooth device to
a new Bluetooth device" (report d9a2f5fe, minutes after bf90bfd6). WHAT THAT
LOG SHOWED: every list after Apple's screen held ONE port, WIDI Master
Bluetooth, the AX3's. The FM3's own WIDI Uhost was never a port on the
iPhone, though he wrote "I'm also connected to the WIDI UHost" (where he saw
that was not said; WHY the iPhone did not have it is NOT KNOWN: switched
off, held by his iPad or Mac, or two WIDIs paired to each other all fit).
Connect lets go of a kept adapter that is not connected so it can be looked
for again (forgetAdapter `forgot`), which made the FM3 look like a unit with
no adapter, so the Master was offered to it; he forgot the AX3's keeping by
hand, the Master was then "the only one here" and was taken, and the app
asked an Axe-Fx III to be an FM3 ("The WIDI Master is on an Axe-Fx III, not
your FM3", which was true). Two changes:
- *A unit's own adapter, away, is named* (lib/bluetooth offerFromOther
  `own`, lib/offerWords `ownAwayNote`): "WIDI Uhost Bluetooth, your FM3's
  adapter, isn't connected to this iPhone. Tap Connect and choose it. If it
  isn't there, it is switched off, or another phone, tablet or computer is
  connected to it." in red over Connect, which stays the big button; the
  other unit's adapter is offered small under it. The big offer (2.1.8,
  below) is only for a unit with no adapter of its own.
- *Switch unit* on the page that is up while Bluetooth is on (lib/unitSwitch,
  lib/bluetooth `switchUnitNow`, test/unit-switch.mjs): the units as tabs,
  and a tap on another STOPS BLUETOOTH FIRST, always (the reason step 1's
  chips are shut while it is on stands: a new unit's messages to whatever is
  on the adapter froze an AM4), switches, and turns it straight back on only
  through that unit's OWN adapter where it is another adapter than the one
  just used, a Bluetooth one, and connected now (`switchPlan`). Anything
  else lands on Connect with the unit picked. Never carried: the last
  unit's adapter stays the last unit's.
- NOT SEEN ON A PHONE, either of them, and the stop-then-on in one tap has
  not run against a real link (it is what Stop and Connect do, back to back).
- WHAT AN UPDATE CANNOT DO: on an iPhone an adapter becomes usable only once
  it is connected in Apple's Bluetooth MIDI screen, which no app can do for
  the player. With both adapters connected there, switching is the one tap
  above. An app connecting an adapter itself (its own Bluetooth code, as on
  Android) would be native work and a build pair: offered, not asked for.

**A report's details say which way the app was connected (2.1.7, 19
November 2026).** "Can't tell if this was on a computer or Bluetooth." (of a
customer's report whose details said "role: connected" and no more.) `role`
is the link's state, not its road. So the phone's details carry
`connection`: computer, Bluetooth, USB cable or demo (mobile/src/lib/linkWay.js,
added in lib/reports `context` beside what shared/report-rules `contextFrom`
makes, so the shared file, and the computer app with it, did not change).
THE WAY ONLY, NEVER THE ADAPTER'S OR THE CABLE'S NAME: the privacy page's
list for a report says "how the app is connected" and keeps names to the
log. The report's email prints every detail, so nothing on the server
changed. The browser's reports do not say it (a browser is always through a
computer).

**Settings → NAM & TONE3000 says how to use them (2.1.6, 19 November
2026), for every account. ITS OWN BUTTON ON THE FRONT OF SETTINGS, under
Amp & pedal names, since 2.2.1: "Move the NAM and tone 3000 help section to
the main settings screen" (the same day; it was a row inside Help).** "Can we put something in the app that
explains people how to use tone 3000 and NAM? Some people might not know
how to add a block for NAM. or to access the tone 3000 section to add a NAM
block." TONE3000's two ways in are both on a NAM block already in the
preset, so somebody without one saw neither. The page (mobile/src/lib/namHelp.js
for every word, components/NamHelp.js, test/nam-help.mjs) is the steps in
order, in a tab for each unit, opening on the linked unit's: put a NAM
block in, open TONE3000 from it (hold the pedal on Play, or Capture in
Edit), Preview and Get, the captures already on the unit, and what to check
when something is missing. AN AM4 IS TOLD TO ADD THE BLOCK ON THE UNIT OR IN
AM4-EDIT, because the app has no message that gives an AM4 slot a NAM block
(a test fails the day it has one, so the words get changed then). It is the
phone's only (`ONE_END` in test/both-ends.mjs), reads and sends nothing,
and KEEP IT TRUE whenever a button it names is renamed or moved.

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
says read-only. Over Bluetooth the Output block is in Edit's chain, and
the speaker is on the top bar, only for an account that
`OUTPUT_AND_SCENE_LEVELS_FOR_EVERYONE` opens (his, on an FM3, FM9 or
Axe-Fx III with Edit open: "The Output block's levels", below). For every
other account the wire still leaves it out (bleWire `OFF_STAGE`), so there
the Level box reaches the amp's and the other blocks' levels, not the
preset's own, and the speaker is the computer's.

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

**Where a knob points is one rule, shared/knob-dial.mjs, and a test asks
it.** "The design of the parameter knob does not match the actual one ...
So min on left side and max on right." (a customer on an FM9, 16 November
2026.) Both knobs, the phone's (mobile/src/components/Knob.js) and the
browser's (src/components/Knob.jsx), had the right start and sweep and
each turned its drawing a further quarter turn: the lowest setting pointed
to half past ten and the highest to half past seven, gap on the left, for
every account on every connection. Nothing asked where a knob points, so
two copies drifted the same way unseen. Now angles are degrees clockwise
from twelve, the sweep is half past seven to half past four, a setting the
same either side of nought (Balance, Pan; not a log one) is lit from
twelve, and test/knob-dial.mjs draws the browser's knob and reads where its
dot and arcs land. The phone turns its marks and pointer by the rule and by
nothing else (the test pins each turn and the pointer's angle). Any new
dial draws from this file.

**The app's own Program Change can come back, on every channel, and is not
news.** The same customer's log: each preset stepped to from the app wrote
"the unit sent Program Change 12: its preset changed" sixteen times, a few
hundred milliseconds after the app sent 12 (his rig sends what it hears
back out on all sixteen channels; a WIDI Master on an FM9). Each copy was
taken as the unit changing preset: Edit's kept chain dropped, a knob turn
waiting refused, sixteen of the log's 400 lines a step. bleWire heardShort
now keeps every Program Change the app sent in the last 1.5 s with its
bank (`OWN_PC_MS`); a copy of one is the app's own, an EARLIER send only
within 600 ms of going (`OWN_OLDER_PC_MS`) and only until its copies, or a
later send's, have come back (a controller taking the unit back to it is a
real change). Nor is any send the app's own once a Program Change has been
taken as news after it (`passed`): the unit has moved off it, so the same
number again is a change, except the rest of a burst of its copies still
coming (within 300 ms of its last copy, `lastCopy`), and, for a send not
heard back yet, 600 ms from going. Never a window from the send for one
heard back: a lone copy after its burst is byte for byte a controller
taking the unit back, and a missed change is the dangerous direction (a
learned echo lag was tried and put back: one slow wave widened it for the
connection and a controller's return was swallowed again). Copies of one number within 300 ms are one burst and one log
line (`PC_BURST_MS`), split only by a bank select heard on that channel
since the burst began. The app's own bank selects coming back are not the
unit answering either, so a quiet unit stays quiet. Four independent reads
went through it before it went out and found eight ways a real change was
swallowed or a copy was news; each has a test seen to fail without its fix. THE LESSON AGAIN: "remember more" swallowed a real
change the first time; ask what a controller sending the same number would
be taken for. Left as they are, by the third read's own verdict: on a rig
that sends nothing back, a controller's change to a preset the app sent
under 600 ms before is taken for the app's own (nothing can tell the two
apart there, and the poll puts it right within two seconds); and the same
preset sent twice inside 300 ms logs one burst for both. And, from the
fourth read: a controller's change before the app's copies come, on a rig
that sends them back later than 600 ms, makes them news (a second
"changed": the safe direction, and on an in-order path the unit really did
take the controller's preset first and the app's after it).

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

**And it moves one step in the last place, which is one digit.**

> "I want to eliminate the second digit from the builds anyway. so instead
> of 1.9.89 and going up by .01 each change would go up by .1 so 1.90.9 to
> 1.91.0 and so on." (16 November 2026)

Since 1.91.0, which came after 1.90.90: each change is the next number,
and after x.y.9 comes x.(y+1).0, so 1.91.9 is followed by 1.92.0. A test
fails on a last place of two digits. Three numbers always: the app compares
a copy's built-in version with the store versions things opened in, and
anything but three numbers compares as nothing (shared/versions.mjs
`isOlder`), so a build called "2.0" would keep Bluetooth and Edit shut for
every customer on it.

**A store build can carry a number the updates do not.**

> "dont change the build number to 2.0.0 on the updartes currently going.
> only after we do the native builds" (16 November 2026)

The 2.0.0 pair is built from main at 1.91.x with "The version number the
stores show for this build" set to 2.0.0 (mobile.yml `store_version`,
scripts/store-version.mjs): app.json says 2.0.0 in that build's copy only,
which is the number the stores, TestFlight and the copy's own
`installedStoreVersion()` read. Nothing is committed, so the updates keep
main's own numbers, and About on a 2.0.0 copy shows the update's number,
as it does on every copy. The version is left out of the fingerprint
(mobile/fingerprint.config.js), so the number decides nothing about which
updates a copy takes.

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

**How a computer takes its update, and a Raspberry Pi's.**

> "I thought the pi apps auto update?" and "You're telling me I need to
> update it myself?" (16 November 2026, his Pi 5 on 1.90.63 with 1.90.82
> out.)

Every computer app downloads its update by itself and puts it in when the
app is QUIT, never mid-set (desktop/lib/updates.mjs). A box nobody quits
(a Pi on a pedalboard is switched off at the wall) also puts a waiting
update in during the first three minutes after it is switched on, before
anybody is playing (`unattendedInstall` in desktop/lib/autostart.mjs).
That used to be only for a start with NO window, and his Pi opens the app
with its window (the guide's way), so it waited for a quit that never
came. Since 1.90.86 an ARM board on Linux (`pedalboardBox`: a Pi) is
treated as nobody there whether or not its window is open. Still only the
AppImage (the .deb asks for a password), never once a phone has used the
box since it started (`phoneSeen`: a download that lands a minute or two
in would otherwise restart it mid-song), and a box that started its own
install comes back by itself if the install does not take, with its window
if one was showing (`installedUnattended` in installNow). An independent
read found all three missing from the first cut. Usually the first
power-on after a release downloads it and the next one puts it in. A Pi on a version older than 1.90.86 is still the old rule
until it is quit once from its menu (Quit puts the waiting update in).
(Since 1.92.0 the power-on rule is the one below: `phoneSeen` became
"anybody used it", and it waits three watched minutes first.)

**A Raspberry Pi puts in its own updates, since computer app 1.92.0 (17
November 2026).**

> "I will update the pis but we need to figure out how to have them auto
> update" (16 November 2026)

Until then a Pi took a waiting update only at power-on, and a Pi left on
never updated. Now (`unattendedInstall`, `startupInstall`, `selfUpdatingBox`
and `quietFor` in desktop/lib/autostart.mjs; `heldStanding`, `heldGoes` and
`heldAskDue` in desktop/lib/updates.mjs; the looks in desktop/main.js):

- *A Pi puts a ready update in once NOBODY HAS USED IT FOR HALF AN HOUR*
  (`IDLE_INSTALL_MS`, equal to the computer's own "nobody is here" half
  hour, `AWAKE_FOR_MS`). Used is six signs, each a way somebody can be
  playing: a phone app's note (phone.seen), a phone's browser on the
  Wi-Fi, the window touched (desktop/preload.js says so, at most every ten
  seconds), the unit changing a preset, scene, setting or the tuner (the
  device server's /events, `unitUse`; never its meters or tempo), another
  program on the Pi using the device server (Axiom: `otherLocalClients`,
  from /proc/net/tcp, the app's own sockets left out), and the computer
  waking from sleep. It is decided only at the end of a look, once a
  minute, and only when that look could read every sign; never when the
  update turns ready.
- *It waits a day after a release comes out* (`RELEASE_SETTLE_MS`, from
  GitHub's published time, `releaseSettled` in updates.mjs), so a bad one
  can be pulled first. EXCEPT A COMPUTER SIGNED IN TO HIS OWN ACCOUNT
  (`OWNER_ACCOUNTS` in updates.mjs, held equal to shared/admin.mjs ADMINS):
  his Pis take a release after the half hour alone, a day before anybody
  else's, so they are the first to meet a bad one. Nothing on any screen
  says so (the window and the phone's entry say the day, which is the rule
  for everybody else).
- *And a release pulled after the download never goes in by itself.* Once
  a download is held, the six-hourly look never asks GitHub again that run,
  so a Pi left on had it long before anybody could pull it. Before ANY
  install nobody pressed for (the idle route, the power-on route, a phone's
  Update now) the app asks GitHub about the HELD version's own release, by
  its tag (`releaseTagUrl`, the same repository as the look, through
  `askGitHub`, never the update library), never whether it is still the
  newest: several computer releases come out a day, and a Pi holding the
  one before the newest must still put it in and then take the newer one.
  There, not a draft, not a pre-release: on as before. A pre-release, a
  draft or gone (404): PULLED, remembered for the run, said once in the
  log; no route puts it in, a phone's request is refused `pulled`, the
  phones are not offered it (`canNow` false) and the menu and window word
  it as one that goes in at a quit. No answer (offline, GitHub erroring,
  rate-limited): the idle route waits for a later look, the power-on route
  goes on (a Pi at a gig with no internet), a phone's request goes on (a
  person asked). Asked only when an install would otherwise go, and at
  most once in ten minutes whatever the answer (`HELD_LOOK_MS`: GitHub
  allows 60 unsigned asks an hour per address). The answer has 15 seconds
  (`HELD_ASK_TIMEOUT_MS`) for its header AND its body together: a 200
  whose body never comes, a body that is not JSON, or a throw is no
  answer, and the ask is cleared (`heldAsking`) and the install's wait let
  go (`heldWaiting`) whatever happens inside it. And somebody can arrive
  while GitHub is asked, so once the answer is back the verdict is made
  again from scratch on everything read fresh (`unattendedVerdict`, the
  same call before the ask and after it), and the install goes only if it
  still says install BY THE SAME ROUTE; otherwise it says why it waits, as
  on any look. A phone's Update now has its busy check (`askBusy`) made
  again after the answer, and is refused `screen` or `busy` if somebody
  arrived. A Mac or PC whose answer comes after its three minutes does not
  install at that login. Restart to update or Quit at the computer is a
  person's choice and still puts it in.
- *Which computers.* Only the Linux AppImage, and then ANY Raspberry Pi by
  its board's name (/proc/device-tree/model), window or not, a Pi 400 or
  500 at a desk included (it puts its own in once nobody has touched the
  Fractal Remote window, the unit and the rest for half an hour, even
  while somebody works in another program on it); and any other Linux
  box running the AppImage that was started with no window (start at
  login passes --hidden, on x64 or ARM) and whose window nobody has opened
  this run. Never a Mac or a Windows PC, never the .deb (it asks for a
  password), never a Linux box whose window has been opened that run
  unless it is a Pi.
- *The power-on rule on Linux stays, with three watched minutes first*
  (`POWER_ON_QUIET_MS`, in the first six, `POWER_ON_WINDOW_MS`), never once
  anybody has used the box that run, and on a box started hidden only while
  its window has not been opened (a Pi, `pedalboardBox`, is a power-on box
  window or not: its window is its touch screen). It does not wait a day:
  a Pi somebody switches on takes a waiting update after the three
  minutes (design decision D5), after the pulled check above. EXCEPT THE
  COPY AN INSTALL NOBODY PRESSED FOR RESTARTED (`restartedByItself`: the
  marker the install leaves says `byItself`, and only a copy the updater
  started reads it): on a box that puts in its own, that copy takes a
  newer release by the power-on route only once it has had its day, or on
  the owner's own; otherwise it waits for the idle route like any Pi left
  on (an independent read: it was a fresh power-on box, and could take a
  release minutes old whose Linux build had not been tried on CI yet).
- *A Mac and a Windows PC are as they were before 1.92.0* (`startupInstall`):
  started hidden, a waiting update goes in the moment it turns ready (and
  at each look for phones), in the first three minutes
  (`INSTALL_WINDOW_MS`), never once a phone has used it; no complete look,
  no unit stream. One thing added: a window opened that run is somebody
  there, so it waits for a quit. (An independent read found the first cut
  restarting a Mac started at login four to six minutes in, under somebody
  who had just opened its window.) The pulled check above runs before it
  too. The unit's /events stream is opened only on Linux, on a box that may
  put one in by itself (`watchesUnit`); on a Pi with no phone it keeps the
  device server reading the unit (its scene and meter watch) for as long
  as the app runs, where nothing did before.
- *Guards.* `installNow` runs once however many ask (the button, the box,
  a phone), and one that threw before the install can be asked again. An
  install that does not take is not tried again in that run or the next
  (the marker reads stuck). The 20-second safety restart starts the
  AppImage's new file when the swap took the old one away (`relaunchPath`).
  And desktop.yml's Linux job has "A Linux build that does not start is
  held back": when a publishing run's Linux build fails, the release is
  marked a pre-release, and the run is red. A computer that has not
  downloaded it never finds it; one that has finds it pulled at the check
  above. So no computer that gets an answer from GitHub puts a pre-release
  in by itself; one that gets none (no internet, a GitHub error or a rate
  limit, as for a Pi at a gig) still does at power-on or a phone's word,
  and any computer at a quit or Restart to update.
- *The words.* The Pi's menu says "Update … goes in when nobody is using
  it"; its window says "Version … is ready. Restart to update, or leave
  it: it goes in by itself once it has been out for a day and nobody has
  used this computer for half an hour."; the phone's Updating the computer
  app page has an entry keyed to that menu line, "It goes in by itself once
  it has been out for a day and nobody has used the computer for half an
  hour. To put it in now, tap Restart to update on its screen.";
  public/raspberry-pi.html has an Updates paragraph, which also says a Pi
  switched on with an update waiting puts it in after a few minutes with
  nobody using it (D5: power-on does not wait the day). The window's
  sentence and the phone's entry describe a computer that is left on and
  say the day; they are left as they are, and so is the What's new line.
  No sentence anywhere says the sound keeps playing or how long the
  restart takes: not seen yet.
- *THE INDEPENDENT READ (17 November 2026), and what it changed.* Three
  real faults, all fixed with a test in test/pi-update.mjs seen to fail
  with its fix taken out: a release pulled after the download still went
  in (the pulled check); the copy an unattended install restarted could
  take an unsettled release at its power-on (`restartedByItself`); a Mac or
  PC started hidden restarted itself four to six minutes after login (the
  old rule back, the window counted). And the gaps its mutants slipped
  through, each a test now: start()'s own wiring of the looks
  (`startWatching`), a look whose note, Wi-Fi or other-programs read comes
  back null, a Linux PC that is not a Pi, `published` carried to 'ready', a
  phone's request refused while a Wi-Fi browser or Axiom was seen, and
  installNow tried again after it threw. Refuted, and left: Update now
  needing a complete look, and an unreadable /proc/<pid>/fd stranding a Pi
  (a sandboxed Electron 33 renderer's can be read by the same user).
- *THE SECOND INDEPENDENT READ (17 November 2026), of the fixes above.*
  Two real faults, both in the wait the GitHub ask added between deciding
  and installing, both fixed with tests in test/pi-update.mjs seen to fail
  with the fix taken out: somebody who arrived while GitHub was asked (a
  scene changed, the screen touched, a phone seen, a Mac's window opened)
  still got the restart, and a phone's Update now still installed under a
  touch made in that time (the verdict and the busy check made again on
  the answer, by the same route); and the 15-second limit covered only the
  answer's header, so a 200 whose body never came left the ask pending for
  the rest of the run, nothing installed by itself again and a phone's
  request was never answered (header and body now under the one limit).
  And a gap in the tests: nothing held what a person sees for a pulled
  release (the menu's quit words, the open window told again, the phones
  told at once); the pulled test holds all three now. The CI step's
  sentence and this file's now say "gets an answer from GitHub", since a
  rate limit or a GitHub error is no answer, and the Pi page says a Pi
  switched on puts a waiting update in after a few quiet minutes. Refuted,
  and left as it is: a release found pulled still goes in when a person
  quits, as any held update always has, and a held download is still the
  end of that run's updating (the `held` rule in lib/updates.mjs).
- *NOT SEEN ON A PI YET:* how long from going in to the remote answering;
  whether electron-updater's AppImage swap and restart work mid-run on his
  Pis; whether the safety restart ever fires and starts the new file;
  whether touches on his small screen reach the page under Pi OS's Wayland;
  that the sound carries on; that an idle unit never sends a scene,
  changed, param or tuner event by itself (if one does, a Pi never goes
  quiet, and its log's "is ready; …" line says why it waits); that the
  device server lets main.js's own /events stream in; that /proc/<pid>/fd
  of the app's processes is readable; whether Axiom keeps a connection open
  while it is open; that GitHub's tag answer reaches a Pi and reads as
  'there' (its log says "… has been pulled from GitHub" or "GitHub could
  not be asked" if not); and that the restarted copy reads its marker
  (`byItself`). His first logs settle these.
- *HIS PIS ON 1.90.63 NEED ONE UPDATE BY HAND*, since that version has none
  of this and does not even take a waiting update at power-on with its
  window: on the Pi, Settings → About → Updates → Check for updates, wait
  for Restart to update, and tap it. Once an update is held the app does
  not fetch a newer one in the same run, so a Pi holding an older one
  installs that first and has to be done once more.
- *THE PHONE'S HALF: built 17 November 2026, OPEN TO EVERY ACCOUNT SINCE 2.0.1 (17 November 2026; his account only until then).* Under the
  computer's card on Settings → Phone & computer, a line says how the
  computer app's own update is going, as the computer says it (the
  `update` note in host.name, read with its name and version every couple
  of minutes): "Up to date", "Downloading version …", "Version … is ready.
  It goes in by itself once it has been out for a day and nobody has used
  pedalboard for half an hour." (the computer's own window's words: a Pi
  not on his account waits the day too), the quit and the password ones
  for a Mac, a PC and the .deb, and an older computer app's "v…, an older
  computer app." with How to update it (a Pi on 1.90.86 to 1.91.x is told
  to switch it off and on instead, with How to update it too, since a Pi
  on the .deb never puts it in at power-on and the phone cannot tell). On
  a Pi with one ready, Update now: a confirm ("The remote stops while …
  restarts, then comes back by itself. Don't save or send a capture until
  it's back."), then "Asking … to update…", "Updating … The remote comes
  back by itself.", and "… is on version …" or the computer's own no in
  words. ("… is on version …" gives way to the computer's own line where
  it is already saying a NEWER version is ready, so the next one is never
  hidden: with Update now where it can go in from here, and its own
  warning where it did not go in last time. A newer version still on its
  way down does not replace it.) How a tap ended (and a "not asked" note under the button) is said
  only while it still describes the computer it was written against: the
  same computer driven, the same version, the same note (hostUpdate
  `stillSo`, `runSays`). It goes for good when any of those moves, and on
  a sign-out (the switch going off here). One Update now at a time, for
  any computer: no button while one is out, and a second tap does nothing.
  Which unit (Settings, and the sheet off the unit's name) gives
  each computer's version and that line too, read only, and "Pick it to
  update it." on one not driven. The rules and every word are one file,
  mobile/src/lib/hostUpdate.js (pure, so test/host-update.mjs runs it
  whole and hands the computer's own `updateNote` and `updateAsk` what it
  builds); the wiring is lib/hostUpdateHere.js and the card
  components/HostUpdate.js.
  - *The switch* is `COMPUTER_UPDATE_FOR_EVERYONE` in features.js, true since 2.0.1 (false until 17 November 2026)
    (lib/hostUpdateHere `useComputerUpdate`, his kept sign-in). Every other
    account sees the card as it was and nothing is written for it; its log
    gets no new line either. It opens when he says so, with its What's new
    line then and the restart time he measured.
  - *The request* is what the computer as built reads, and nothing more:
    `{ host, version, account, at }` in host.update, through the relay, to
    the computer driven. Written at most twice a tap: once, and once more
    at 30 seconds if neither has been answered and the update is still
    offered (a computer that had only just started learns the first
    without acting on it). Never while two computers answer to the driven
    one's name (a write reaches both), never while this device has a write
    to the computer out or finished in the last ten seconds (relay.js
    `sendingHere`: a save, a capture, a chain change; the phone's own note
    is not counted), and never for an account the switch is off for, asked
    again at each write. The second write goes only between 30 and 60
    seconds after the tap (`RETRY_UNTIL_MS`): a look the device held back
    (the app in the background) never writes long after it, under a
    request nobody is waiting on. The phone gives up after three minutes:
    "… didn't update. It stays on version …".
  - *Only the computer asked is read.* The relay reads whichever computer
    is driven now (another picked, or the relay's own fallback while a Pi
    restarts), so a read under another name is no read. A run whose last
    read was another computer's ends 'left': the log says whether it
    updated is not known, and no card says anything about either.
  - *The log* ('update') says what the computer said about its update when
    it changed, each request written, the answer, and the give-up.
  - *Two limits, LEFT, neither fixed.* The ready line ("Version … is
    ready. It goes in by itself once it has been out for a day and nobody
    has used … for half an hour.") is the computer window's own sentence,
    held to it by a test, and is true of a customer's computer. A computer
    signed in to his own account skips the day's wait (desktop/lib/updates.mjs
    `OWNER_ACCOUNTS`, autostart's `ownerBox`) and no screen says so, so
    while only his account sees the line it names a wait his own Pis do not
    make. The give-up line ("… didn't update. It stays on version …. It
    tries again by itself once nobody has used it for half an hour.") leaves
    the day out, the other way round. Look at both again before
    `COMPUTER_UPDATE_FOR_EVERYONE` is turned on. And the second request
    goes only between 30 and 60 seconds after the tap (`RETRY_AFTER_MS`,
    `RETRY_UNTIL_MS`). A Pi that had only just started needs it (its first
    look learns a request without acting on it), so two failed reads in a
    row inside that half minute lose it: the card says the Pi did not
    update, and a second tap works. An independent check judged it too
    unlikely to change: it takes a Pi in the first minute of its app and
    two reads lost back to back in the same half minute.
  - *NOT SEEN ON A PI YET:* no Update now has been pressed on a real Pi.
    Not known: how long from the tap to the remote answering again, that
    the remote does come back by itself, and whether the unit's sound
    carries on through the restart. No sentence says a time or the sound.
    Nor whether a computer signed in to an account other than the phone's
    answers at all (it ignores such a request, so the phone gives up after
    three minutes with no reason given).

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

**A row of buttons that wraps can put the dangerous one where the safe one
was.** Edit's title came out one letter to a line on a 375-point window
with Confirm changes showing (15 November 2026), and the first fix let the
four buttons wrap. An independent read found what that did: a wrapped row
fills from the left, so on a small phone "Confirm changes" took the top
right corner, where Done had been the moment before, and a thumb going for
Done would have written over the preset. The second fix wrapped them
upwards, so Done kept the corner, and a second read found the same thing
by another road: at a larger system text size the wrapped block, centred
in its row, brought Confirm changes up under Done's old place. THE LESSON
IS THE THIRD FIX: it is not left to arithmetic. Done is not in the group
that wraps at all (Edit.js `HEAD_SIDE` holds that group, and then Done, in
a row that does not wrap), so no width, text size or state can stand
anything else where Done is. The other two rules, in
mobile/src/lib/editHead.js: while a save is asked about or going, on a row
measured and found narrow, the magnifier and More step aside
(`headTucked`), so Confirm changes grows leftwards from where Save stood;
and the title's side never has less than 72 points, which its two words
need at the standard text size (NOT at large ones: see below). Laid out in
Yoga itself (the engine React Native uses) at sixteen widths, nine text
sizes and seven title heights, every move a save makes left only Done, or
nothing, where Done had been. Before a button is let move, ask what the
thumb that was aimed at its old place now lands on, and prefer a
structure that cannot get it wrong to a number that usually gets it
right. And a share of a shared flex shrink is a point or two: enough to
wrap a button on a phone where everything fitted, which is why the
title's side is `flex: 1` with a floor and not a shrink factor.

What the third read found that is NOT mended, because every mend of it
is a trade and none is unsafe: a row cannot hold the title, Confirm
changes and Done at a large system text size (a 375-point iPhone from
about the second size up from standard), or on a 320-point window at any.
Then the button's label is cut short ("Confirm chan…", the warning line
under the head still whole) and the title keeps its 72 points, which
"(Beta)" no longer fits from about one and a half times the text size.
`HEAD_ROOM` does not look at the text size either, so on an iPad at
those sizes the magnifier and More stay and the group wraps. And while a
save is asked about the magnifier and More are away for as long as it is
(until it is confirmed, or the warning is put down): a search box that
was open stays open with nothing to close it but picking a result. The
real answer at large text is a head of two lines (title over buttons),
which is his to see first. The author's own model of the head gave every
button a fixed width, which is how it missed the cut label: MODEL A
BUTTON WITH A MEASURED WORD IN IT.

**The checks run the tests in two ways a run here does not.** Each failed
a pull request on 17 November 2026, with nothing wrong in the app either
time:

- *A second time with every patch in docs/pending put in* (web.yml, "The
  tests again, with every patch waiting for a build in", which sets
  `PENDING_APPLIED=1`). A test that puts a waiting patch in for itself has
  to allow for it being in already (test/line-up.mjs took it back out
  then, until the patch it read went into main on release day for 2.0.0),
  and a test that reads a file a patch changes has to hold both
  ways. To run it that way before pushing: make a copy of the working
  tree, apply each patch named in docs/pending/README.md the way that step
  does, and run `PENDING_APPLIED=1 npm test`.
- *On Windows* (desktop.yml's windows job runs the whole suite), where
  node:path joins with backslashes. The stood-in disk the computer app's
  tests use is keyed the Linux way, so a test that reads a file off it by
  a '/'-joined path hands the app Linux path rules (test/pi-update.mjs
  `LINUX_PATHS`). To see it here, hand the stood-in app
  `require('node:path').win32` in test/run.mjs loadDesktopMain's `stand`
  and run the file. And a test that walks the real disk and names a file
  by cutting its path at '/mobile/' gets the whole Windows path back, so
  its list never matches (that failed a third pull request the same day,
  test/mobile.mjs, the Output levels' switch): turn the backslashes first,
  `full.replaceAll('\\', '/').split('/mobile/')[1]`, as test/glass.mjs and
  the rest do.

**`test/structure.mjs` reads App.jsx as text, not as code.** It finds screens
by searching for the literal conditional that opens them and takes the first
hit — so writing that same conditional higher up the file, *including inside
a comment*, hands the test the wrong block. Both of those have happened. Give
the condition a name instead.

**On the phone, a touch handler made once keeps the render it was made
in.** The volume pop-up is drawn by the top bar when the app opens, before
any chain is read, and its slider's handler (`useRef(PanResponder.create(…))
.current`) is that first render's for the life of the screen. Whatever it
calls at the end of a drag read the Output block from that render: nothing.
So a drag moved the level and then said "No output level to move yet — the
chain is still loading", with 0.0 dB on screen, and the value the thumb
came off on was never confirmed (16 November 2026; the writer had been
fixed for the same thing and the landing had not). Anything such a handler
reaches reads what it needs from a ref (`live.current`), never from the
render. Reading the file as text could not see it: every line was right,
and what was wrong was which render's line ran. test/volume-drag.mjs runs
the real pop-up over several renders with stand-in hooks, and its last
check puts the fault back to prove the bench catches it. Reach for that
shape whenever a phone component's fault is about WHEN something was made.

And a ref that every draw writes again is not a safe place for what a
thumb sets. The first fix put the dragged level on that same ref, which an
effect rewrites after every draw from what was drawn; the draw a touch-move
asks for leaves its effect for later, and the next move can run first. So
the draw of +10 could put +10 back over the +15 the thumb had moved to, and
a thumb that came off then had +10 confirmed on a unit at +15 (found by the
review, in the React Native renderer's own code, the same day). The level
has its own ref now (`level`, set only by `show`), and the bench has
`render` (draw, effects left waiting) and `flush` beside `draw`, because a
bench that runs every effect at once cannot see this at all.

Two more were in the pop-up before any of this, found on the lines the fix
touched (the second review, the same day), and both are closed:

- A press of − or + waits 350 ms to be confirmed, and the read of the level
  at each open is held back while one waits, so a quick close and open does
  not show an older level over the press. It was held back for ANY press:
  a press, then a preset whose Output is another block inside that second,
  and the new block's level was never shown. The slider read "—", and the
  next + stepped from the bottom of the range: −79 dB, the sound all but
  gone. The wait says which block it is for now (`settle.current.eid`), a
  block that goes takes its waiting press with it, and no press or drag is
  ever counted from a level that is not known.
- **The level is the preset's, not the block's.** The Output block is the
  same id in every preset of an FM3, FM9 or Axe-Fx III, and on all three,
  so the id never said the level under the slider was another preset's: a
  footswitch to the next preset left the last one's level on the slider,
  and a press still waiting was confirmed on the new preset, with Save
  lit. The pop-up keys the level to the unit and the preset number as well
  (`ofSounding`), drops it and reads it again when either changes, and
  counts each change (`settle.current.turn`) so that nothing still going
  out lands on a level that has gone, a block that went and came back
  under the same id included. What it cannot do: the app hears of a
  footswitch a moment after the unit has stepped, and a press confirmed
  inside that moment has already gone to the new preset.
- **Save is told as the level is sent**, not only once it is confirmed.
  The key changes for a preset change that did not happen too: the
  watch's Next puts the new number up at once and a unit that refuses it
  puts the old one back, and a unit that stops answering for a moment
  has no number. The level is dropped and read again each time, and a
  press's wait goes with it; told only at the confirm, Save never heard
  of a level the unit was left holding (the fourth read of that day).
- A drag's landing was not marked as landing at all, so a quick close and
  open while it was still going out showed the level the unit held when
  the open asked, and the landing then said nothing (it only speaks for
  the level on screen). A drag lands through the same door as a burst of
  presses now (`landDrag`).

Neither has been seen on a phone; both were run on the bench, which has a
slow wire for the second (`unit.slow`).

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

**And a unit answers a SET with the SET itself, which is no echo
(1.90.84).** Justin's Axe-Fx III through a WIDI Uhost, 15 November 2026: a
block's channel changed and two blocks switched off from Play, and at the
third the log said "the unit is echoing what it receives: the white plug
may be in the Axe-Fx III's MIDI THRU, not OUT". His plug was in OUT. On an
FM3, FM9 or Axe-Fx III a block's on and off (0A), its channel (0B), the
scene (0C) and the tempo (14) are one message each way: sent with a value
it sets, and the unit answers in the same shape with the value it is now
on. So the answer to a SET it took is the phone's own bytes, and the echo
guard counted each as an echo. Three and the log
named a THRU plug; and ONE was enough to undo the paragraph above, since an
empty preset's answer was taken at its first copy only where nothing had
echoed on that connection: after any block switched on or off, a preset
with no blocks read as the unit not answering again.

- The first copy of such a SET to come back is the unit's answer and is
  not counted (bleWire `answersItself`, and `lastSent.copies`, which counts
  each sent message's copies whoever takes them). A second copy of the same
  message is an echo and is still counted in `echoes` (counts(), the Echo
  test), but since 1.91.4 it no longer rings the alarm or holds an empty
  preset's read: a rig wired wrong is named by the copies of its QUESTIONS,
  which a plug in THRU echoes too (the 1.91.4 bullet, below). Never a question (7F in the value's place): the echo of "which
  scene?" is what the guard exists for. Not on an AM4, whose messages are
  another shape.
- A plug that only loops, with nothing behind it, gives one copy of a SET,
  which cannot be told from the unit's answer and is not counted; its
  copies of the questions are, and they name it.
- WHAT EACH RESTS ON. On and off and the channel: seen on a unit (that
  log, three of three; only the third has a time, 46 ms). The tempo: NOT
  SEEN, and the codec's notes quote Fractal's document for the scene's
  "Returns" line only; it is in the list on the pattern of the others, and
  if a unit does not answer a tempo so, all that is lost is the count of
  one copy of a tempo set through a THRU plug. The scene's set is not in
  the list: it waits for exactly that answer and takes it itself, as it
  always has (`allowEcho`). Do not write that the document says this of
  on and off, the channel or the tempo until somebody has read it there.
- THE PRETEND UNIT IN THE TESTS TOOK THESE SETS IN SILENCE, which is
  kinder than a unit, so no test ever saw the answer. It answers a set it
  takes with the set now (`setsAnswered`, on by default): on and off and
  the channel in every wire test, the tempo only where a test says the
  unit takes the published tempo (`publishedTempo`). A set it does not
  take it still meets with silence; what a unit says then is not known.
- So "the unit is echoing what it receives" in a log from before 1.90.84,
  from an FM3, FM9 or Axe-Fx III, says nothing about the plug unless Thru
  is known to be on. From 1.90.84 until 1.91.4 it took three copies of
  anything sent but a set's first copy (a write's as much as a
  question's), and a Quick build over Bluetooth could ring it (below).
- AND QUICK BUILD'S "SELECT A CELL" (01 30) CAME BACK TOO. Report
  913f344a, 16 November 2026, his Axe-Fx III through a WIDI Master, his
  first Quick build over Bluetooth: the third select came back byte for
  byte 104 ms after it went, and the alarm rang there over a rig wired
  right. That the other two counts were the first two selects is
  inferred, not shown (a copy that lands after the next message has gone
  is not counted at all). Whether a cable (01 35) or an Undo's put of
  block 0 comes back so is NOT KNOWN: every cable in that log went after
  the alarm, which is said once a connection, and no Undo was run. With
  the count off nought, the Undo's own read of the preset it had just
  emptied would have read as the unit not answering.
- SO SINCE 1.91.4 THE ALARM AND THE EMPTY-PRESET RULE COUNT COPIES OF
  QUESTIONS ONLY (bleWire `questionEchoes`): anything the app asked of the
  unit, of any kind, its own or another unit's (askAround), never a write,
  whichever write a unit answers with itself. A unit never answers a
  question with the question itself (the one that does, "which blocks?"
  of an empty preset, says so with `opts.same`), so a copy of one is an
  echo however the rest is wired, and a plug in THRU or one that loops is
  still named by them: an FM3 or FM9 with MIDI Thru on during a build
  (Quick build asks which preset the unit is on before every step), and an
  Axe-Fx III with its plug in THRU, which never answers at all (its
  answers leave by OUT) and is named by its probes. `echoes` (counts(),
  the Echo test) still counts every copy but a set's first, as before.
- THE LOG SAYS WHICH COPIES SET IT GOING: "the first copy of a question to
  come back on this connection: …" and, after the alarm, "the copy that
  made it three: …", each with the message, which copy of it, and how many
  milliseconds after it went. Read those first when the alarm is in a log.

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
else, then whether this adapter has ever answered this unit (below: a stuck
link looks exactly like swapped plugs).

**With ONE adapter, zero bytes was read as the plugs: a customer's report of
14 November 2026. Not proven, and since 16 November (below) known not to be
the only reading** (an Axe-Fx III, an iPhone on iOS 27.3, a WIDI Master, the
app at 1.90.69 on store copy 1.90.0, a first setup: one adapter listed, the
same one every time). Connected, and "nothing at all has come back (0
bytes)" through four runs and twenty minutes of Connect again, Use a
different adapter and restarts. Not even the phone's own bytes came back,
which rules out the white plug in the III's THRU (that echoes). Nothing in
the wire is new since the versions that answer on Justin's own III. THE
READING THAT FITS, NOT PROVEN: a WIDI Master is two pieces, a larger plug
with the light that powers it from MIDI OUT (so it connects to the phone
with only that one in) and a small one on a thin cable for MIDI IN, which
CME calls optional. With the small one out, or its cable not seated, the
unit never hears the phone and nothing ever comes back. What the app got
wrong, fixed in 1.90.74:

- **The hint named a cable the customer did not have.** "Check both MIDI
  plugs: the white one goes in MIDI OUT" is the C2MIDI Pro's colours. A
  WIDI Master's line names its own two plugs now (shared/bluetooth-gear
  `notAnsweringLine`, `isWidiMaster` by the adapter's name; on every unit,
  the FM3 too since 15 November 2026, when no adapter was ruled out for one
  any more), and the chain card in Settings the same
  (shared/link-chain).
- **Play said "Connected over Bluetooth, through WIDI Master Bluetooth."
  the whole time.** The note under the pill, where Connect again is, said
  nothing about the unit; what to check was on the Bluetooth page. With
  the adapter connected and the unit silent it is that page's line now
  (components/TopBar `Which`, `quiet`).

A reply was drafted for Justin to send (the two plugs, then unplug the
adapter for a few seconds, then forget it in the iPhone's Bluetooth
settings and connect again from the app). If the customer writes back that
both plugs were in, the next thing to ask for is a log after doing exactly
that, and whether Axe-Edit reaches the unit over USB at the same time.

**Zero bytes is ALSO a stuck link, and then the plugs are the wrong first
step: Justin's FM3, 16 November 2026.** His WIDI Uhost with a CME U2MIDI Pro
on the FM3's MIDI jacks, an iPhone on iOS 27.2.1: Connected, and not one
byte back from 17:07 to 17:22, through about a dozen of the app's
reconnects, a full restart of the app (new MIDI ports), three drops and
returns, and a brand-new connection made in Apple's screen. What cured it:
Forget This Device in the iPhone's Settings → Bluetooth, the Uhost
unplugged and plugged back in, paired again; the FM3 answered 42 ms after
that connection, on the same CoreMIDI ids and the same code. The plugs were
never touched. It had hit two paying customers too.

> "Most people aren't stupid and don't have them plugged in backwards ...
> your number one thing is to make sure they're plugged in correctly with
> MIDI out and MIDI in, and that's not the problem." And: "if we need to
> build something in the app to disconnect it automatically or to pull up
> the Apple thing to un-pair and re-pair, whatever we have to do, we need to
> get this fixed."

- **KNOWN.** The fault was below the app. On an iPhone the Bluetooth link is
  iOS's: Connect again and the link's own "let go and connect again" only
  unhook and hook the app's MIDI port on it (FractalBleMidiModule.swift
  connect and disconnect), never the link (on Android they do drop it, the
  7 November cure). No app can forget an iPhone's pairing or open Settings →
  Bluetooth (App Review 2.5.1). And zero bytes is what swapped plugs, a WIDI
  Master's small plug left out, and a stuck link all look like; only a plug
  in THRU brings bytes back.
- **NOT KNOWN.** Which half of his cure mattered: he forgot the pairing and
  unplugged the Uhost at once. A Uhost hung after its move from the Axe-Fx
  III fits as well as a stale pairing. Whether the 17:18 drops were him
  unplugging it, whether the MacBook still had the FM3 on USB, the Uhost's
  firmware, and whether other WIDIs, the iPad or the Mac had hold of it. So
  the 14 November customer's case may have been either.
- **WHAT THE APP DOES NOW (an update, no build).** bleLink tells the page
  (lib/bluetooth `nothingBack`) once its own first questions on a connection
  brought back not one byte, past the connection's first eight seconds
  (`NOTHING_BACK_MS`), on a connection after the round's first was made
  afresh; never for a VP4 or a USB cable; down when the unit answers on a
  connection, never on bytes that are no answer, not at a drop (the reset's
  first step), and at a new round. The Bluetooth page then draws the reset
  card (screens/Bluetooth `ResetCard`, words in shared/bluetooth-gear
  `resetSteps`), one step at a time with Still nothing: restart the adapter
  by what powers it (`restartWords`: a Uhost's USB power; a WIDI Master's or
  MD-BT01's plugs, which are its power, each back in its own jack, never
  "unplug its power"), Bluetooth off and on in Settings, Forget This Device
  and pair again (only "if it is listed there"; never where Apple's screen
  is kept shut), close the app, other gear nearby (CME's WIDI app only under
  a WIDI), the plugs, and a report whose first line says the steps done. Its
  place is kept on the phone (closing the app is a step), and the log says
  which step it was on when the unit answered: over a few cases that tells
  the pairing from the adapter. Play's note leads with "Nothing is coming
  back from WIDI Uhost, so the app can't hear the FM3." and Fix it step by
  step. Troubleshooting has the same resets in the same words before the
  plugs. Connect again's line on an iPhone says it asks the unit again over
  the same link.
- **WHAT AN INDEPENDENT READ FOUND, FIXED BEFORE IT WENT OUT (16 November
  2026, 23 findings, each with a test seen to fail without its fix).** THE
  CARD VANISHED ON THE RESETS THAT WORK: on an iPhone the same adapter comes
  back from a restart or a fresh pairing under new CoreMIDI ids, the link
  took that for a new round and dropped nothingBack, and the page fell back
  to the plugs advice this card replaces; "answering again" was never said.
  Now lib/bluetooth decides ONCE, in chooseAdapter, whether an adapter is
  the same one back (an iPhone, the same name, its old id no longer
  connected, not kept for another unit), and bleLink asks it
  (`adapterCameBack`) and keeps nothingBack up; the answered record and the
  card's place carry WHEREVER it is chosen again (Reconnect through Apple's
  screen, Stop then Connect: forgetAdapter remembers what it forgot). A
  footswitch connected as the adapter never gets nothingBack or Fix it step
  by step. "The FM3 is answering again." lives 8 s (`RESET_BACK_MS`, a
  timer in lib, whichever screen is up). A place saved on Close the app
  comes back on the next step. The words never claim an adapter "hasn't
  answered before" (nothing is seeded, so that was false for every
  customer): "First time with the WIDI Uhost on your FM3? Check its plugs
  first."
  A SECOND READ, OF THOSE FIXES, found six more, fixed the same way: a
  place left on Close the app and never finished logged "the app was opened
  again" at every launch for good (a place past `RESET_KEEP_MS` now goes
  from the phone, and the step after Close the app is saved, not only
  held); a Connect tapped on the page before the card came up still sent
  the page to Play the moment a reset worked, so "answering again" was
  never seen (the card disarms that jump; a Connect after it arms it
  again); and four tests that did not yet hold what they named (the card
  with no Reconnect yet, the moved place written to the phone, `forgot`
  being one unit's and gone at the next choice, and the same name in other
  capitals). A THIRD READ, of those, found the disarm undone on Android by
  the page's own Turn on Bluetooth, drawn over the card on its Turn
  Bluetooth off and on step: it armed the jump again, so the page still
  left for Play the moment that step worked. It does not arm while the card
  is up now. THE LESSON AGAIN: the fixes were read, and that read found
  the next faults.
- **THE PLUGS BY WHAT IS KNOWN, never dropped on bytes alone.** lib/bluetooth
  keeps, per unit and adapter, the day the adapter last answered that unit
  (`adapterHeard`, under its own key `fractal.bluetooth.heard`: keptAdapter
  keeps four fields and drops anything more), and notes an adapter taken
  from another unit's keeping as just moved until it answers there. The
  card puts the plugs last only where this adapter has answered this unit;
  first, inside the restart, where it never has (every customer today:
  nothing is seeded); and one plug line beside the restart where it was just
  moved, its cables plugged in again. Troubleshooting cannot know, so it
  says "First time with this adapter on your FM3, or just moved it here?
  Check its plugs first" at the top.
- **ANOTHER UNIT'S ADAPTER IS OFFERED, NEVER TAKEN.** At a Connect for a unit
  with no adapter of its own, with another unit's the only one here, the
  page offers "Use WIDI Uhost for your FM3? It was your Axe-Fx III's." under
  Connect (lib/bluetooth `offer`, `takeOffered`), one tap that moves it. The
  7 November rule stands (bleAdapters pickAdapter): it cost him ninety
  seconds and three trips through Apple's screen that day, but taking it
  silently is how the AM4's WIDI Jack once went to the FM3.

**The phone and the browser share one relay allowlist.** `shared/relay-rules.mjs`
is the source; `mobile/src/lib/relay-rules.js` is generated from it by
`npm run sync:rules` and a test fails if it is stale. Never hand-edit the
generated copy.
