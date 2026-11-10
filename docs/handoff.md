# Handoff, 9 November 2026

For the next session. CLAUDE.md holds the rules; this is where things
stood when the last session ended. Everything below shipped as
over-the-air updates: no Expo build was started today.

## Shipped today (all merged to main)

- #835 (1.90.3): docs/app-store.md records the 1.90.0 App Store texts as
  Justin submitted them. The Apple trademark line without the VP4 is
  shared/affiliation-apple.mjs.
- #836 (1.90.5): on a tablet, the walkthrough and the Unlock page fill the
  screen (mobile/src/lib/tabletScale.js, useRoom.js, components/Roomy.js).
- #837 (1.90.6): Bluetooth page, "Use the USB cable" button and the FM3's
  U2MIDI Pro straight into the iPad (report 8519c338).
- #838 (1.90.7): two sides, step 2: Edit, Setlists and All presets beside
  Play on an iPad on its side or the opened iPhone Duo, his account only
  (docs/two-sides/README.md is the plan; steps 3 to 6 remain).
- App Store header/search artwork made (docs/store-art/), words "Control
  your Fractal from your iPhone". NOT uploaded: Justin uploads it himself
  in App Store Connect → Product Page Information → Header and Search
  Results (header 21:9 JPG, search 3:2 JPG, or the one 16:9 PNG).

## Where the stores stand

- 1.90.0 is WAITING_FOR_REVIEW at Apple (iOS build 32) and sent to Google
  Play (version code 16). It opens Edit over Bluetooth on the AM4, FM3,
  FM9 and Axe-Fx III (`EDIT_FROM_STORE` all 1.90.0; ledger row and
  `EDIT_OPENED_AT` are in).
- The submitted review notes still read "Tested on: iPhone 17 Pro Max,
  iOS [version]; Apple Watch [model], watchOS [version]" with the
  brackets unfilled. Justin was told; he can edit App Review Information
  while it is still editable.
- Live day for each store, when 1.90.0 is approved: public/store-versions
  .json; the website's editing words and the setup email's
  `EDIT_IN_EMAILS` only once BOTH stores have 1.90.0 (test/limits.mjs
  refuses them before); Apple release only once the trial item is
  approved too.
- Justin's Play Console steps still open: App access note, Data safety
  (Name optional, Fraud prevention, delete link
  https://fractal.newbold.cloud/privacy.html#delete), Send changes for
  review.

## Waiting on Justin

- The read-only bug-report door: the Supabase function read-reports is
  live and the migration applied; it needs his key saved as a Network
  secret on the environment (host biznwrqeckviawjuhvyg.supabase.co,
  header x-reports-key, name "Bug reports key"), then the README step-5
  enrol (set the one-time READ_REPORTS_ENROLL, POST /enroll, unset it).
- His first look at two sides on the iPad and the Duo (nobody here has a
  Duo). Unsettled: the Duo half's foot (one row of five as in the mockup,
  or the iPhone's two rows it has now), and icons on the side bars.
- His first look at Derek's panel (hold a block on the iPad on its side).
  Nothing here can draw it: it bundles and its rules are tested, and the
  screen itself is his to see. On an 11-inch iPad eight scenes sit in one
  row over seven blocks, so there the panel takes the left of the screen
  and the blocks are squared again beside it (they stay put only where the
  scenes and blocks were already side by side).

## Next in line (not started)

- Two sides step 5 (polish, and the Save / Don't save / Stay question
  before Play throws away unsaved changes from Edit or Derek's panel),
  6 (open to customers: `SIDES_FOR_EVERYONE`). Steps 3 (the tuner in a
  side, 1.90.10) and 4 (Derek's block panel, 1.90.15) are in.
- Play listing (#56 in the old task list): confirm Grok's update, sync
  store/google-play, delete UNCHECKED.
- Later, from docs/later.md: NAM through the computer, VP4 opt-in editing
  (two decisions pending), FM3/FC6 recording session.

## How this session worked (so the next one can too)

- Worktrees off origin/main with node_modules symlinked from a full
  install; commit, `git merge -s ours` the working branch
  claude/fractal-remote-continue-ljfqcd, push to it, open the PR, wait for
  every check, confirm the CI log says "Unchanged, so this ships as an
  update and costs no build.", squash-merge with its own title and
  message, check main's four workflows started.
- The fingerprint is only trustworthy in a checkout with its own
  node_modules (the symlinked worktrees report both phones moved on
  untouched main).
- Two Windows failures today were tests comparing file paths with forward
  slashes: turn backslashes round (`replaceAll('\\\\', '/')`) before
  splitting on '/mobile/'.
- A timing test (the browser's Copy Logs deadline) can fail when two test
  suites run on the machine at once; alone it passes.
