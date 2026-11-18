# Handoff, 18 November 2026

For the next session. CLAUDE.md holds the rules; this is where things
stood when the last session ended. No Expo build was started in it: the
2.0.0 pair (iOS build 33, Android version code 17) was already built.

## The session after this was written (18 November 2026, later)

He asked for everything the computer does to work over Bluetooth, "like
chain editing and live tuner on phone and Apple Watch". #938 was already
merged. The first pass went in as 2.0.5, three switches in
mobile/src/lib/features.js, TRUE for every account since the same day on
his word ("Open it up to everyone"), none seen on a unit: `TUNER_ASKS_FOR_EVERYONE` (an FM9's or Axe-Fx III's tuner asks the
unit when its switch brings nothing), `CHAIN_EDITOR_OVER_BLUETOOTH_FOR_EVERYONE`
(move, add, remove a block; slow over an adapter, and it says so) and
`EDIT_TOOLS_OVER_BLUETOOTH_FOR_EVERYONE` (Rename, Copy channel). CLAUDE.md,
*The computer's tools over Bluetooth*, has all of it and what is left:
modifiers, a gen-3 cab picker, the looper's buttons, the unit's own click,
the Footswitches page, an AM4's volume. The working branch for it was
claude/intelligent-keller-854qlw. No build: the fingerprint did not move.

To check frames against the codec the computer app carries: check out
forgefx-midi at the commit in desktop/forgefx.lock.json, `npm ci`, then
`npx tsc -p .`, and import from its dist/ in a scratch script.

## And after that (18 November 2026, later still): the rest of the computer's tools over Bluetooth

He confirmed Apple's 2.0.0 is in review, and asked for the rest. Built in
2.0.6, each behind its own switch, all FALSE (his account only), none seen
on a unit: the looper's buttons, the unit's own metronome click, modifiers,
a cab picked by name, and the Footswitches page (FM3 only, as at the
computer), on an FM3, FM9 and Axe-Fx III. CLAUDE.md, "THE SECOND PASS", has
each one. An AM4's volume button turned out not to exist through the
computer either. They open when he says, and not into a review without his
knowing an update reaches the reviewer's copy.

## Shipped (all merged to main unless it says open)

- #934 (2.0.0): release day. The five waiting patches into main, the
  fingerprint the 2.0.0 build's own. Updates reach 2.0.0 copies only from
  here; the stores' 1.90.0 copies are frozen on update 1.92.7.
- #935 (2.0.1): everything that was his account's opened to everyone
  (eighteen `_FOR_EVERYONE` switches). The preset wheel is gone.
- #936 (2.0.2): scripts/store-release.mjs and store/app-store/2.0.0.json;
  store-text.yml's "A new version's texts" box.
- #937 (2.0.3): scripts/store-shots.mjs, play-text's `screenshots` mode,
  the first four screenshots.
- #938 (2.0.4), OPEN when this was written, head on
  claude/fractal-remote-continue-ljfqcd: the whole 2.0.0 Description
  (store/app-store/2.0.0-description.txt), `clear_iphone` and `clear_ipad`
  on the screenshots job, three more iPhone pictures, the iPad pictures,
  and this file. Merge it when every check is green and the mobile check
  says Unchanged; nothing else is waiting on it.

## Where the stores stand

**Apple, 2.0.0: prepared, NOT submitted. Justin presses Add for Review
himself** ("OK, just don't submit. I will submit it myself"). Written into
App Store Connect by the store-text job, on his word:

- the version made and build 33 attached;
- What's New (seven short lines), and the review notes changed in place
  (a New in 2.0.0 block, TONE3000 in the demo and services lines). Its
  "Tested on" line says Apple Watch Ultra 2, which was carried from the
  1.89.3 notes and is a guess: he was told to check it;
- the new Description (three ways to connect: Bluetooth, USB cable,
  computer; edit and save; NAM and TONE3000 on the Axe-Fx III). No VP4;
- screenshots: every old iPhone and iPad picture removed, then 7 iPhone
  (room for 3 more) and 3 iPad (his 11-inch iPad's, scaled to the 13-inch
  sizes). The Watch's 4 were not touched.
- On Add for Review Apple asks: Content Rights (yes), two new age-rating
  questions (No), and user-made content, which is his call.
- Noticed and told to him: iPad picture 2 shows a "v1.91.0" label; the
  TONE3000 picture shows other makers' gear names.

**Google Play, 2.0.0: still in internal testing, NOT public.** He asked
for it to go public ("I don't ever promote Google. Please get it done").
It could not be done from here: the listing robot cannot promote a
release, and sending the same build to production was refused ("This
version code was already uploaded"). Three ways, waiting on his choice:

1. a fresh Android build straight to production (recommended; one of
   about 9 Android builds left this month, and it needs his yes);
2. he presses Promote release in Play Console;
3. he gives the listing robot "Release to production" and a promote job
   is built.

Play's release notes and App access paragraphs are drafted in
docs/app-store.md's 2.0.0 section. Play's phone screenshots (7, cropped of
the iPhone's clock row and home bar, 1320x2640) were added and are in
Google's review; room for 1 more.

## Waiting on Justin

- Add for Review on Apple, and the watch model in "Tested on".
- Which of the three ways for Google.
- Three public store-text run logs show his private review-video links
  (runs 42746423693, 42544698328, 42539143687). Deleting them from here
  was blocked twice; he deletes them in GitHub → Actions → the run → ⋯ →
  Delete all logs.
- Optional: a fifth review video, for TONE3000.

## Next in line

- Once he submits: record the 2.0.0 texts as submitted in
  docs/app-store.md and the ledger in docs/expo-builds.md.
- Each store's live day: public/store-versions.json to 2.0.0; the saving
  words on public/bluetooth.html and public/support.html; the setup
  email's "with no saving" (his yes, then a redeploy); the Google Play
  description when he asks.
- A second note to Guido: block order, live knobs and scene levels are
  open to everyone now.
- The first reports from customers on 2.0.x: CLAUDE.md's list "What
  customers have now and nobody has seen on a unit" is what to read first.
- Still open from before: Quick build in the browser and the chain editor
  over Bluetooth; the refused top-row cable (after a row-2 build is seen
  to join); Scene N labels; the live grid comparison; VP4 opt-in editing;
  why his iPhone once would not turn; an Android phone on 2.0.0 seen
  connecting through a computer.

## How the store jobs are run

- Apple: Actions → store-text → Run workflow. It runs from any branch, so
  new files can be tried from the working branch before they merge. Boxes:
  `show` (reads only), `release` (a version, e.g. 2.0.0: its texts from
  store/app-store/<version>.json and <version>-description.txt), `shots`
  (with a version: its pictures from store/app-store/screenshots/<version>/
  iphone, ipad), `clear_iphone` and `clear_ipad` (remove every picture of
  that kind first; only when he asks for a whole new set), `apply` (Write
  it; unticked only shows what would change). Run unticked first. Its key
  CAN submit a version; the job has no code that does, and none is to be
  added unless he asks.
- A 401 from Apple's key was transient once: try again before calling a
  key dead.
- Google: Actions → play-text, from main only. `screenshots` mode adds
  pictures from store/google-play/screenshots/<version>/phone. Play's
  rule: the long side no more than twice the short, 8 at most.
- Pictures are cropped and scaled with Playwright's Chromium (the
  container's Python imaging library is broken). His originals are kept
  as they came; an iPhone picture is never stretched into an iPad one.
- Never print the review notes, the review login or the video links: the
  repository and its Actions logs are public.

## How the work goes

- Worktrees off origin/main; one open pull request at a time from
  claude/fractal-remote-continue-ljfqcd; every pull request moves the
  version in package.json and desktop/package.json, then
  `npm run sync:rules`.
- Merge only when every check is green and the mobile check's log says
  "Unchanged, so this ships as an update and costs no build."; squash with
  its own title and message; give him the link.
- The fingerprint is only trustworthy in a checkout with its own
  node_modules.
- The machine is short of memory: never two whole test suites at once.
- He said to skip checking on Android builds: it costs him usage credits.
