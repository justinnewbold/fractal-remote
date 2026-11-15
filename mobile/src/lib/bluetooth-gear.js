/* Generated from shared/bluetooth-gear.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * BLUETOOTH: WHAT TO BUY, HOW IT PLUGS IN, AND WHERE THE FULL GUIDE IS.
 *
 * "We need to provide as much instructions as possible on how to connect it
 * and hook it up. So as far as I know, we need a CME Widi host. And then for
 * the AM4 I use these as well. Maybe we could add these with the Amazon
 * links on how to buy them? Cause I'm not sure what's needed for every single
 * device, but it is working with the AM4."
 *
 * ONE PLACE FOR EVERY ADDRESS. The phone's Bluetooth page reads this (its
 * generated copy, mobile/src/lib/bluetooth-gear.js), and so does the test
 * that holds the website's guide to it: public/bluetooth-guide.html is plain
 * HTML and cannot import a module, so test/bluetooth.mjs reads every Amazon and
 * CME link on that page and fails on any that is not one of these. A link
 * changed here and not there, or there and not here, is a red run rather
 * than a guitarist buying the wrong thing.
 *
 * THE LINKS, as checked on amazon.com itself on 10 October 2026 (title,
 * seller and the page's own canonical address, read off the live page): the
 * plain /dp/<number> form, with no tracking on the end. No prices: they
 * change, and a price in the app is wrong the day it does.
 *
 * WHAT IS KNOWN TO WORK, since 26 October 2026, from an iPhone and an
 * Android phone ("They also work with both iPhone and android"): his AM4,
 * through the WIDI Uhost, the C2MIDI Pro and the two 3.5 mm adapters, and
 * through a WIDI Master ("The AM4 also works fine using the Widi Master.
 * And works with the Widi Uhost as well"); and his FM3, through the WIDI
 * Uhost and a U2MIDI Pro ("Using the U2midi pro adapter the FM3 works and
 * does not get hot"). The FM9 and Axe-Fx III have the 5-pin MIDI
 * jacks the C2MIDI Pro was made for, so the same chain without the adapters
 * may work on them, and the VP4 has the AM4's 3.5 mm Type-A jacks, so the
 * AM4's whole chain may — but nobody has tried any of them, and the page
 * says so rather than promising it. From the store version that opens
 * Bluetooth (beta) to customers (lib/ble-rule.js UNITS_FROM_STORE), every
 * unit is offered, each untried one marked so with the report button by it:
 * "as long as there's warnings for user that it's in beta and they're free
 * to test it and submit feedback, but it might not work properly" (Justin,
 * 25 October 2026).
 *
 * NOT THE C2MIDI PRO OR THE WIDI MASTER ON AN FM3. "I tried to use the exact same WIDI host
 * setup on the FM3 as I did on the AM4 and the CME C2MIDI Pro got extremely
 * hot on the FM3 and the connection didn't work." The C2MIDI Pro's white plug
 * can feed itself from the MIDI OUT it goes into (CME's manual: "can be
 * powered from the MIDI OUT port of most MIDI devices ... the MIDI device must
 * comply with the MIDI standard"). The standard puts a 220-ohm resistor behind
 * that pin; FM3 owners measured in 2021 that the FM3 has none, and report the
 * same on the Turbo in 2025 and 2026. So every adapter that feeds from it runs
 * hot there — CME's WIDI Master and WIDI Jack, Yamaha's MD-BT01, this cable —
 * and USB power does not stop it. Then, on 26 October 2026: "The Widi
 * Master did not work on the FM3 and got very hot." So the FM3's warning
 * names both, red and in front of everything else for an FM3.
 *
 * THE U2MIDI PRO ON AN FM3. CME's USB-A cable with the same black and white
 * plugs, "Powered via Standard 5V USB bus" (CME's page) and never from the
 * MIDI OUT it goes into. On his FM3, through the Uhost: it works, and stays
 * cool. So the FM3 has a shopping list and steps of its own (the U2MIDI Pro
 * in the C2MIDI Pro's place), and everybody is told before any pick that
 * the C2MIDI Pro and the WIDI Master were never for an FM3 (until 15
 * November 2026: below).
 *
 * A WARNING, NOT A NEVER, SINCE 15 NOVEMBER 2026. "I have now confirmed
 * that from a user that The Yamaha B101 works also in addition to the
 * WIDIJack that works but gets hot. So On the FM3 Instead of saying NEVER
 * use a different Bluetooth device, just have a warning that devices on the
 * FM3 may overheat and to use at their own risk." (Justin; "B101" is read
 * as Yamaha's MD-BT01, the one Bluetooth MIDI adapter Yamaha makes for MIDI
 * jacks.) Until then the FM3 had one way, the Uhost and a U2MIDI Pro, every
 * other adapter was refused for it by name (FM3_NEVER_NAMES, neverOnFm3,
 * namedForFm3: never picked, never offered when another was missing, never
 * switched to), and the words said "never" in red. Now: the FM3 is offered
 * the Uhost and the U2MIDI Pro first, as the way that stays cool, then the
 * Yamaha MD-BT01 and the WIDI Jack; nothing is refused for an FM3 by name;
 * and FM3_WARNING, red wherever the FM3 is picked, says an adapter may
 * overheat, that it is the owner's own risk, to unplug one that gets hot,
 * and what happened here (the WIDI Master and the C2MIDI Pro got very hot
 * on his FM3 and did not work, which is why neither is among its ways).
 * Still what happened and what owners report, never a fact about the
 * unit, and still no home-made way round it.
 *
 * NO RECIPE FOR THE WAY ROUND IT. The warning and the guide once said what
 * FM3 owners fit (a resistor on one pin of a home-made adapter, "someone who
 * solders can make one"). A soldering job is not something this app can
 * stand behind, nor one to send a stranger to: they say what happened, that
 * owners report the same, and to keep the parts off an FM3.
 *
 * AND SAID AS WHAT OWNERS REPORT, never as a fact about Fractal's hardware:
 * the app has measured nothing on an FM3 but a hot cable.
 *
 * THE PLUGS, from CME's own manual for the C2MIDI Pro: the BLACK plug, marked
 * TO MIDI IN, goes INTO the unit's MIDI IN; the WHITE plug, marked TO MIDI
 * OUT, goes into the unit's MIDI OUT. Swapped, nothing gets through either
 * way. On an Axe-Fx III the white plug goes in OUT, never THRU: THRU only
 * repeats what comes in, so the phone would hear itself and never the unit.
 *
 * NOT YET CHECKED AGAINST HIS RIG, plug by plug. What he has said is that he
 * uses these three parts on the AM4. The route through them in hookupFor —
 * the C2MIDI Pro's USB-C straight into the Uhost's left socket, the charger
 * in the right, black to MIDI IN and white to MIDI OUT through the adapters —
 * is the one the makers' manuals give for those parts, not one written down
 * from his. He is being asked (a photo of it plugged in would settle it);
 * if his differs, his is the one that works, and this and the website's
 * guide change to match it.
 *
 * THE POWER, from CME's manual for the Uhost: when it is the "host" — which
 * it is here, with the C2MIDI Pro plugged into it — its right-hand socket,
 * USB Power, has to be fed 5 volts from a charger or power bank, and nothing
 * stronger. That one supply runs the C2MIDI Pro too. And the unit is on and
 * started before the Uhost gets power: FM9 owners on Fractal's forum report
 * a unit that sometimes would not start, or froze, with a WIDI running while
 * it booted, and letting it start first was the cure.
 *
 * MIDI THRU OFF on the AM4, FM3 and FM9 (Setup → MIDI/Remote). With it on,
 * the unit sends the phone's own messages straight back. The Axe-Fx III has
 * no such setting; the plug just stays out of its THRU jack.
 *
 * THE DEVICE IN HAND, PASSED IN. Since 16 October 2026 the app names it
 * (shared/device-word.mjs deviceNoun: phone, iPad, tablet), and Bluetooth is
 * no longer one man's iPhone: an iPad or an Android tablet with Bluetooth MIDI
 * opens the page too. This file imports nothing, so partsFor and hookupFor
 * take the noun as an argument, 'phone' when nobody says.
 *
 * Pure data with no imports, so the phone's copy is a plain copy.
 */

/**
 * The full guide on the website, for everything that does not fit on a phone
 * screen. At bluetooth-guide.html, linked from /bluetooth since 1.89.3 went
 * live in both stores (30 October 2026). In the app, the Bluetooth page links
 * here, and, since 7 November 2026, Connect a computer's Connect over
 * Bluetooth where nobody has paid yet (from the sign-in screen), on a copy
 * that opens Bluetooth to customers: the guide is anybody's to read.
 */
export const GUIDE_URL = 'https://fractal.newbold.cloud/bluetooth-guide.html'

/*
 * THE UNITS IT HAS BEEN TRIED ON: OUR RECORD, NOT THE CUSTOMER'S. "We don't
 * need to mention really whether or not something has been tested or not,
 * we just need to keep track of it ourselves in the developer menu so that
 * we can confirm it or if someone leaves us a note saying it doesn't work
 * then we can investigate." (Justin, 31 October 2026.) Until then every
 * untried unit said "Not tried yet" wherever its owner looked; now nothing
 * a customer reads says tried or untried, and this, TRIED_WAYS and
 * TRIED_NOTES are drawn on Developer → App health → Tried (BluetoothTried),
 * and named in a report's log head (unitForReport), where they are ours.
 *
 * The Axe-Fx III since 31 October 2026: "had someone confirm that this works
 * on the Axefx lll", with a screenshot of Play live on one over Bluetooth
 * from an iPhone, its scenes and chain read; which adapter was not said.
 * The FM9 since 1 November 2026: "FM9 has already been tested and works"
 * (Justin); which phone and adapter were not said. The VP4 is the one
 * left.
 *
 * The AM4 by USB cable from an iPhone since 27 October 2026, with no
 * adapter (his reports that day, store copy 1.89.3: its own USB-C straight
 * in, and a C2MIDI Pro plugged straight into the iPhone, both on Apple's
 * USB MIDI driver), and again on 3 November: "I've already used my iPhone
 * and it does connect." A cable is not a way on the page (TRIED_WAYS has
 * none), so it is kept in the AM4's note, and no other unit has run on one.
 */
export const TESTED = ['am4', 'fm3', 'fm9', 'axefx3']

/** What we know of each try, for the Developer page. */
export const TRIED_NOTES = {
  am4: 'From an iPhone and an Android phone, 26 October 2026; the WIDI Jack on 28 October; by USB cable from an iPhone, 27 October 2026 (its own USB-C straight in, and a C2MIDI Pro plugged straight into the iPhone), and again 3 November.',
  fm3: 'From an iPhone and an Android phone, 26 October 2026, with the U2MIDI Pro: the WIDI Master and the C2MIDI Pro got very hot on it. A customer’s Yamaha MD-BT01 works on one, and a WIDI Jack works but gets hot (Justin, 15 November 2026; which phone was not said).',
  fm9: 'Confirmed working, 1 November 2026. Which phone and adapter were not said.',
  axefx3: 'From an iPhone, 31 October 2026: a customer confirmed it works. Which adapter was not said. Justin’s own (Mark II, firmware 33.01) from his iPhone, 13 November 2026: Edit’s knobs on the NAM block all work.'
}

/*
 * THE BUTTON THE NOTE POINTS AT, named once, so the note and the button can
 * never call it two different things. On the Bluetooth page under the note,
 * and wherever else a Bluetooth problem is met (the note under Play's pill,
 * a fault on Play while over Bluetooth, the waiting screen), it opens the
 * report screen (mobile/src/screens/Report.js), which goes to
 * Justin and nobody else: help with the app is his own channels only.
 */
export const REPORT_BUTTON = 'Report a Bluetooth problem'

/*
 * THE LINE AT THE FOOT OF THE BLUETOOTH PAGE: the button for a problem, and
 * nothing more. It said where Bluetooth had been tried, "So far, Bluetooth
 * has been tried on the AM4 and the FM3, from an iPhone", until 31 October
 * 2026: "we don't need to mention really whether or not something has been
 * tested". (It was the beta note, BETA_NOTE_IPHONE and BETA_NOTE_ANDROID,
 * one per phone because Apple's 2.3.10 keeps an Android phone's name out of
 * an iPhone app; with no phone named, one line does for both.)
 */
export const REPORT_NOTE = `Something not working? Tap ${REPORT_BUTTON}.`

/*
 * TWO WAYS TO CONNECT, BLUETOOTH FIRST. "I think most people are gonna opt
 * for Bluetooth, probably 90%. So we need to make that the most prominent
 * thing ... we need to go through the whole app and make sure it's Bluetooth
 * first as far as connection options go. It says no Bluetooth connects
 * through a computer instead." (Justin, 7 November 2026.) Until then this
 * said "The computer is the best one", from his 25 October words ("make it
 * clear that the computer is the preferred method and that Bluetooth will
 * have more lag and not have as many features"), and every first screen led
 * with the computer.
 *
 * So the order is Bluetooth, then the computer, and there is no ranking. What
 * the computer adds is still said, in one short clause, wherever the full
 * sentence is: "A computer has less lag and more features". That is our
 * wording of his 25 October point, not his words, which were "Bluetooth
 * will have more lag and not have as many features". The features half is
 * true on every unit, the VP4 too; the lag half is his own point, and on a
 * VP4, which reads nothing back over Bluetooth, nobody has measured it:
 *
 * LESS LAG: the preset list is read a name at a time over a 5-pin MIDI cable
 * (bleWire NAME_GAP_MS), an AM4's scene names take seconds the first time a
 * preset is seen, and a footswitch change shows at the next poll, up to two
 * seconds later (POLL_MS). "Lag" is his word.
 *
 * MORE FEATURES: over Bluetooth there is no editing or saving, no looper,
 * volume button, unit metronome click or Footswitches page (the page's
 * DIFFERENT list); and a VP4 gets presets and scenes only, while through the
 * computer it also gets its effects turned on and off, the name of the
 * preset it is on, and a check that a preset or scene landed
 * (VP4_OVER_BLUETOOTH). Never the tuner, which a VP4 does not get from the
 * app either way (shared/vp4-safety.mjs VP4_NO_TUNER).
 * Never "plus editing and saving", which it said for a day: through the
 * computer a VP4 is not edited or saved either (shared/vp4-safety.mjs
 * VP4_SO_FAR), and the purchase page names the VP4. The detail is on the
 * Bluetooth page's What Bluetooth can't do, where somebody who wants it
 * looks: "that kind of stuff can come into troubleshooting guides".
 *
 * THE SHORT LINES LEAVE THE CLAUSE OUT ON PURPOSE: the walkthrough's, the box
 * before Unlock, the sign-in screen's Get connected, How do you connect to
 * your unit? (HOW_CONNECT) and the website's BLUETOOTH_IN_APPS say the two
 * ways, Bluetooth first, and nothing more ("eliminate so much of the
 * text").
 *
 * NOT "AND DOES EVERYTHING". On the purchase page it would sit beside the
 * list of what a VP4 cannot do from the app yet.
 *
 * The sentence (the Bluetooth page's foot and What Bluetooth can't do), its
 * button line, and the Settings row's own one line: written together here so
 * they can never say different things.
 */
export const BLUETOOTH_WAYS = 'Bluetooth needs no computer, just an adapter on your unit, sold separately. A computer has less lag and more features.'
export const BLUETOOTH_WAYS_SHORT = 'No computer needed'
/*
 * THE SETTINGS ROW, OFF, in the one line a row has (Settings.js SetupRow, cut
 * at one line on a 320-point screen): what it is for. The cost is said where
 * the two ways are set side by side, not on the row that opens the page.
 */
export const BLUETOOTH_ROW_OFF = 'Off · no computer needed'

/*
 * "HOW DO YOU CONNECT TO YOUR UNIT?", once, after an account is made, a trial
 * started or the full version bought, where this copy offers Bluetooth
 * (mobile/src/components/HowConnect.js). "Signup was difficult, no tutorial.
 * No mention of bluetooth" and "just immediately says, looking for computer,
 * no tutorial, nothing after signing up for the free trial" (Justin, 7
 * November 2026). Two choices and nothing to read: Bluetooth first and
 * biggest, then his own words for the other way, "No Bluetooth connects
 * through a computer instead".
 */
export const HOW_CONNECT = {
  head: 'How do you connect to your unit?',
  bluetooth: 'Bluetooth adapter',
  bluetoothSub: BLUETOOTH_WAYS_SHORT,
  computer: 'No Bluetooth adapter?',
  computerSub: 'Connect through a computer instead'
}

/*
 * THE FM3'S WARNING IN ONE LINE, for where there is room for one: the
 * website's /bluetooth page (held to this word for word by a test) and the
 * foot of the purchase page's parts. It said "never the C2MIDI Pro or a
 * WIDI Master" (NOT_FOR_FM3) until 15 November 2026, and was drawn under
 * every other unit's parts too, for an FM3 owner reading the wrong list;
 * with the unit picked first and only its own adapters shown, it is not.
 */
export const FM3_SHORT = 'On an FM3, a Bluetooth adapter may overheat: use one at your own risk. The CME U2MIDI Pro runs on USB power only, and stays cool.'

/*
 * THE PURCHASE PAGE'S LINE, on a copy that opens Bluetooth to customers: one
 * short line, the two ways, Bluetooth first. "Way too much text, should not
 * have to scroll" (Justin, 7 November 2026, of the purchase page, which
 * carried every part of every adapter above the trial button).
 */
export const BLUETOOTH_PAYWALL = 'Connect with no computer, through a Bluetooth MIDI adapter sold separately, or through a computer, which has less lag and more features.'
/* The tap under it that shows BLUETOOTH_PARTS. */
export const BLUETOOTH_PARTS_SHOW = 'Which adapter do I need?'
/*
 * AND THE PARTS, ONE TAP AWAY (BLUETOOTH_PARTS_SHOW), on the same page: which
 * units, what a VP4 gets over it, and every part each way of the Bluetooth
 * page takes, by the name on its box (PARTS, below) and what it is, plus
 * POWER_LINE's charger, with no prices. Named here, not sent elsewhere:
 * nobody who has not paid can open the Bluetooth page. And the FM3's
 * warning, after the parts.
 *
 * AND THE WAYS THE BLUETOOTH PAGE OFFERS (waysFor), since the audit of 3
 * November 2026 found this list still naming only the Uhost kit of 25
 * October: the page has put the WIDI Master first since 26 October (one
 * piece, powered by the unit, no charger), then the WIDI Jack, then the
 * Uhost. Never a sentence that says it works on a unit, only what each unit
 * takes; and the FM3's own list, with the small adapter its U2MIDI Pro needs,
 * and its warning in a line (FM3_SHORT).
 */
export const BLUETOOTH_PARTS = `It is offered on the AM4, FM3, FM9, Axe-Fx III and VP4, and on a VP4 it changes presets and scenes only. It needs a Bluetooth MIDI adapter, sold separately. On an AM4, VP4, FM9 or Axe-Fx III that is a CME WIDI Master, the simplest (one piece, powered by the unit), a CME WIDI Jack, or a CME WIDI Uhost with a CME C2MIDI Pro cable and a USB charger or power bank; on an FM9 or Axe-Fx III, a Yamaha MD-BT01 too. On an AM4 or VP4, the WIDI Master and the Uhost also need two Type-A MIDI to 3.5 mm adapters; the WIDI Jack’s TRS-35 bundle does not. On an FM3 it is the WIDI Uhost with a CME U2MIDI Pro, a small USB-C to USB-A adapter, and a USB charger or power bank, or a Yamaha MD-BT01 or a CME WIDI Jack. ${FM3_SHORT}`

/*
 * THE WALKTHROUGH AND THE SIGN-IN SCREEN, ON A COPY THAT OPENS BLUETOOTH.
 *
 * "It doesn't require a computer anymore if people are using Bluetooth
 * instead. So we can drop that now." (Justin, 30 October 2026, of the store
 * listing.) The phone's first minute still said the computer was the only
 * way until the audit of 2 November 2026: the demo's last page said the app
 * works with a computer, and Get connected on the sign-in screen gave the
 * computer's steps and nothing else. So on a copy that opens Bluetooth to
 * customers, and on a device that can do it (the purchase page's own gate,
 * Paywall.js), the phone says both ways in those two places instead
 * (mobile/src/screens/Onboarding.js and SignIn.js). On every other copy, and
 * in the browser, which has no Bluetooth to offer and does need the
 * computer, the words in shared/onboarding.mjs are what is shown.
 *
 * AND THE BOX TICKED BEFORE UNLOCK. "I understand this app requires a
 * computer connected to my Fractal unit via USB cable for the Fractal Remote
 * app to work" is his own sentence, dictated word for word, in a file that
 * says "Do not change any wording without asking me first." So it was held
 * until he answered. Put to him on 3 November 2026 with the sentence below,
 * he said "I'll need you to make sure these are updated with the Bluetooth
 * information correctly" of the walkthrough's pages, the box among them. So
 * a copy that opens Bluetooth shows `agree`, and the browser, which does
 * need the computer, keeps his sentence (shared/onboarding.mjs P3.real).
 *
 * HERE AND NOT IN shared/onboarding.mjs, because the browser draws that file:
 * a line it carries and never shows would still make a new computer app
 * (scripts/computer-fingerprint.mjs hashes every file the web app imports).
 *
 * MY WORDING, and he can change any of it. The demo's line was mine already
 * (P9.demo.sub, "These two lines are mine"). Each line names Bluetooth first
 * and says "no computer" before it, so neither half reads as a computer
 * reaching the unit by Bluetooth (nothing does that). Never the "free"
 * desktop app here (docs/app-store.md: "That could confuse people thinking
 * the iOS/android app is free"). An adapter sold separately, because no
 * Fractal unit has Bluetooth of its own; the purchase page names every part
 * one tap away (BLUETOOTH_PARTS).
 *
 * SHORT, SINCE 7 NOVEMBER 2026: "absolutely way too much text ... it needs to
 * be just clear steps to get connected and how things work in the tutorial"
 * and "we also need to eliminate so much of the text". Each line said "The
 * computer is the best way: Bluetooth has more lag and fewer features." at
 * its end until then (the box before Unlock was 48 words; it is 26). What a
 * computer adds is said where the choice is made and paid for: the purchase
 * page (BLUETOOTH_PAYWALL) and the Bluetooth page (BLUETOOTH_WAYS).
 */
export const WALKTHROUGH_TWO_WAYS = {
  /* In place of P9.demo.sub, under Here’s the app at the end of the demo's walkthrough. */
  demoSub: 'This app connects to your Fractal with no computer, through a Bluetooth MIDI adapter sold separately, or through a computer connected to it by USB.',
  /*
   * The sign-in screen's Get connected card, in one line on such a copy:
   * setting up the computer is on Connect a computer (the desktop app, the
   * same account on both, the link by email), the computer's three steps are
   * in Troubleshooting (It will not connect at all), and once the account is
   * in, How do you connect to your unit? asks (HOW_CONNECT).
   */
  setup: 'Make an account, then connect with no computer, through a Bluetooth MIDI adapter sold separately, or through a computer.',
  /* In place of P3.real.agree, the box ticked before Unlock. */
  agree: 'I understand this app connects to my unit with no computer, through a Bluetooth MIDI adapter sold separately, or through a computer running the desktop app.',
  /*
   * Under the page after Restore finds a purchase (P6), which asked only
   * whether the computer app is installed: somebody with no computer had to
   * answer No and was told to download it (the audit of 3 November 2026).
   * Under RESTORED_BLUETOOTH_GO, drawn first.
   */
  restored: 'No computer needed: sign in, and the Bluetooth page opens. It takes a Bluetooth MIDI adapter, sold separately.'
}

/* The first button on that page, over his Yes and No: to sign-in, as Yes goes, and on to the Bluetooth page. */
export const RESTORED_BLUETOOTH_GO = 'No computer - I’ll use Bluetooth'

/*
 * PLAYING WITH NO INTERNET, where Bluetooth is offered (Settings, the page
 * of that name). It said only "use the computer's own page in the web
 * browser", and Bluetooth needs no internet at all: the device talks to the
 * adapter on the unit, and the sign-in and the purchase are kept on it (the
 * audit of 3 November 2026). A function, for the device word, read when the
 * page is drawn.
 */
export const NO_SIGNAL_BLUETOOTH = {
  off: (noun) => `No signal? Bluetooth needs no internet: the ${noun} talks to the unit itself, through a Bluetooth MIDI adapter on its MIDI jacks, sold separately.`,
  on: () => 'You’re on Bluetooth, which needs no internet, so there is nothing to change.',
  go: 'Connect over Bluetooth',
  /* Under the button, over the steps it leads into: the computer's way with no signal. */
  browser: (noun) => `To use the computer with no signal, open its own page in the ${noun}’s web browser:`
}

/*
 * HOW IT WORKS, BOTH WAYS. "Has this screen been updated ...? Needs to say
 * computer or Bluetooth" (Justin, 3 November 2026, of the walkthrough's first
 * page). His three boxes and their words stay as they are (shared/
 * onboarding.mjs CHAIN, P2): on a copy that opens Bluetooth they are the
 * Computer way, and the Bluetooth way is the other choice, drawn the same
 * way with one box fewer: the unit, the adapter on its MIDI jacks, the
 * phone. Bluetooth first and picked to start with since 7 November 2026
 * ("make sure it's Bluetooth first as far as connection options go"); the
 * computer was, as "the best one", until then. The choice
 * row costs 44 + 16 of height on both ways, so on those copies the boxes and
 * the cable are drawn tighter (Onboarding.js `tight`) and the Computer way
 * ends no lower than the page did before it: he had text taken off this
 * screen so its button shows without scrolling. Anywhere Bluetooth is not
 * offered the page is as it was. Here for the reason the lines above are.
 */
export const HOW_TWO_WAYS = {
  /* The two choices, in this order, the first picked to start with. */
  ways: [
    { key: 'bluetooth', label: 'Bluetooth' },
    { key: 'computer', label: 'Computer' }
  ],
  /* The line between the unit and the phone, the Bluetooth way. */
  wire: 'BLUETOOTH MIDI ADAPTER',
  /* Under the phone's box, the Bluetooth way. */
  phoneBody: 'Your remote - no computer needed',
  /* In place of the demo's line, the Bluetooth way; the button under it still offers the demo. */
  foot: 'The adapter plugs into the unit’s MIDI jacks and is sold separately.'
}


/**
 * THE AMAZON LINKS CARRY HIS ASSOCIATES TAG, and say so. "Replace all the
 * links for the devices with these ... with your tag added" and "Put this
 * line near 'What to buy'" (Justin, 9 November 2026). The tag is his
 * Amazon Associates Store ID with Amazon's own suffix; it follows him, not
 * the app's name. Amazon's agreement wants the sentence below, word for
 * word, on every page such a link is shown: the Bluetooth guide, the
 * Raspberry Pi guide, and the app's own How to connect page. Once a page,
 * at its foot, never beside the links: "Just put this in one section at
 * the bottom of the page- not next to every link" (Justin, 10 November
 * 2026; a day earlier it sat under What to buy). A link with no tag
 * earns nothing, so every amazon.com link here and on the website has it
 * (a test holds that), and nothing else is ever put on the end of one.
 */
export const AMAZON_TAG = 'justinnewbold-20'
export const AMAZON_DISCLOSURE = 'As an Amazon Associate I earn from qualifying purchases.'

/** The parts, by the name printed on the box, each with what it is for in a line. */
export const PARTS = {
  uhost: {
    name: 'CME WIDI Uhost',
    /* What the player's phone, iPad or tablet connects to: partsFor fills the noun in. */
    does: (noun = 'phone') => `The Bluetooth adapter. Your ${noun} connects to it.`,
    amazon: 'https://www.amazon.com/dp/B09GS326QW?tag=justinnewbold-20',
    maker: 'https://www.cme-pro.com/widi-uhost/'
  },
  c2midi: {
    name: 'CME C2MIDI Pro',
    does: 'The cable from the Uhost to the unit’s MIDI jacks: one USB-C plug, a black MIDI plug and a white one.',
    amazon: 'https://www.amazon.com/dp/B0GVXTX5D1?tag=justinnewbold-20',
    maker: 'https://www.cme-pro.com/c2midi-pro/'
  },
  /*
   * THE FM3'S CABLE, in the C2MIDI Pro's place: it runs on USB power only.
   * Its USB plug is the larger USB-A kind (CME's page: "USB-A"), and the
   * Uhost's sockets are USB-C, so it goes in through a small adapter. No
   * Amazon link: none has been checked against the live page yet, so its
   * button is CME's own page.
   */
  u2midi: {
    name: 'CME U2MIDI Pro',
    does: 'For an FM3, in place of the C2MIDI Pro: the cable from the Uhost to the FM3’s MIDI jacks, with a black MIDI plug and a white one. It runs on USB power only, and stays cool on an FM3. Its USB plug is USB-A, so it goes into the Uhost through a small USB-C to USB-A adapter.',
    amazon: 'https://www.amazon.com/dp/B0BH8DHCLY?tag=justinnewbold-20',
    maker: 'https://www.cme-pro.com/u2midi-pro-usb-to-midi-cable/'
  },
  /*
   * THE U2MIDI PRO'S WAY INTO THE UHOST. Its plug is USB-A and the Uhost's
   * sockets are USB-C, so a short Anker adapter goes between them (A8165,
   * USB-C plug to a USB-A socket, checked against its Amazon page on 26
   * October 2026).
   */
  usbA: {
    name: 'USB-C to USB-A adapter',
    does: 'For the FM3: the U2MIDI Pro’s USB plug is the larger USB-A kind, and this lets it go into the Uhost’s USB-C socket. Any small USB-C (plug) to USB-A (socket) adapter does; this one is Anker’s.',
    amazon: 'https://www.amazon.com/dp/B01COOQIKU?tag=justinnewbold-20',
    maker: null
  },
  /*
   * THE WIDI MASTER: the adapter and its two MIDI plugs in one, powered by
   * the unit's MIDI OUT alone (CME: "No external power option"). Tried and
   * working on an AM4, through the two 3.5 mm adapters (26 October 2026).
   * Not among an FM3's ways: on his it got very hot and did not work.
   */
  master: {
    name: 'CME WIDI Master',
    does: (noun = 'phone') => `The Bluetooth adapter and its MIDI plugs in one piece. Your ${noun} connects to it. It takes its power from the unit’s MIDI OUT, so there is nothing else to plug in.`,
    amazon: 'https://www.amazon.com/dp/B08F8F57JX?tag=justinnewbold-20',
    maker: 'https://www.cme-pro.com/widi-master/'
  },
  /*
   * THE WIDI JACK, two ways it is sold: with cables ending in 3.5 mm plugs
   * (the TRS-35 bundle, for an AM4's or VP4's jacks, its switch set to Type
   * A) or in 5-pin plugs (for an FM9 or Axe-Fx III). Powered by the unit's
   * MIDI OUT, or by USB-C power into its own socket. Not tried with the app
   * on any unit yet.
   */
  jackTrs: {
    name: 'CME WIDI Jack, TRS-35 bundle',
    does: (noun = 'phone') => `The Bluetooth adapter, with two cables that end in 3.5 mm plugs for the unit’s MIDI jacks. Your ${noun} connects to it.`,
    amazon: 'https://www.amazon.com/dp/B08ZZSYKQX?tag=justinnewbold-20',
    maker: 'https://www.cme-pro.com/widi-jack/'
  },
  jackDin: {
    name: 'CME WIDI Jack, 5-pin DIN bundle',
    does: (noun = 'phone') => `The Bluetooth adapter, with two cables that end in 5-pin MIDI plugs. Your ${noun} connects to it.`,
    amazon: 'https://www.amazon.com/dp/B08ZZSVM1J?tag=justinnewbold-20',
    maker: 'https://www.cme-pro.com/widi-jack/'
  },
  /*
   * YAMAHA'S MD-BT01: two plugs on a short lead, one for MIDI IN and one
   * for MIDI OUT, powered by MIDI OUT alone (its manual: "Power: MIDI OUT";
   * its lamp flashes when the instrument is on, and lights steadily once a
   * device has connected). A customer's works on an FM3 (Justin, 15
   * November 2026). No Amazon link: none has been checked against the live
   * page, so its button is Yamaha's own page (checked 15 November 2026).
   */
  mdbt01: {
    name: 'Yamaha MD-BT01',
    does: (noun = 'phone') => `The Bluetooth adapter: two plugs on a short lead, one for MIDI IN and one for MIDI OUT. Your ${noun} connects to it. It takes its power from the unit’s MIDI OUT, so there is nothing else to plug in.`,
    amazon: null,
    maker: 'https://usa.yamaha.com/musical-instruments/keyboards/products/accessories/md-bt01/index.html'
  },
  adapters: {
    name: 'Two Type-A MIDI to 3.5 mm adapters',
    does: 'For an AM4 or VP4: their MIDI jacks are small 3.5 mm ones. Each adapter has a 5-pin MIDI socket (female) on one end and a 3.5 mm plug (male) on the other. They must be Type A. This is a pack of two (LOOTOOLS).',
    amazon: 'https://www.amazon.com/dp/B0FN83P5P7?tag=justinnewbold-20',
    maker: null
  },
  /*
   * THE PAIR THE WIDI MASTER WAS TRIED WITH ON AN AM4: "It also needs a 5
   * pin female to TRS male adapter" (Justin, 26 October 2026, with the
   * Amazon page of the ones he used: Eldraqth BMIDI-5-35, Type A, a pack
   * of two). The same kind of part as the LOOTOOLS pair, which the Uhost
   * way was tried with.
   */
  masterAdapters: {
    name: 'Two Type-A MIDI to 3.5 mm adapters',
    does: 'For an AM4 or VP4, between the WIDI Master and the unit: a 5-pin MIDI socket (female) on one end for the WIDI Master’s plug, and a 3.5 mm plug (male) on the other for the unit’s jack. They must be Type A. This is a pack of two (Eldraqth).',
    amazon: 'https://www.amazon.com/dp/B0FJRB9KGV?tag=justinnewbold-20',
    maker: null
  }
}

/** Every address this file gives, for the test that holds the website's guide to it. */
/*
 * Only the three parts, and the guide. Nothing else the guide mentions gets a
 * link: an adapter nobody has tried with the app is named there without
 * anywhere to buy it, and the test holding the guide to this list is what
 * keeps it that way.
 */
export const ALL_LINKS = [GUIDE_URL, ...Object.values(PARTS).flatMap((p) => [p.amazon, p.maker])].filter(Boolean)

const UNITS = { am4: 'AM4', fm3: 'FM3', fm9: 'FM9', axefx3: 'Axe-Fx III', vp4: 'VP4' }

/*
 * THE FM3'S WARNING, red, wherever the FM3 is the unit picked: on the
 * Bluetooth page (under the units, and while it is on), over its ways on
 * How to connect, and over Troubleshooting. One sentence set for all of
 * them since 15 November 2026 (there were two, FM3_WARNING and FM3_NEVER,
 * worded apart).
 *
 * WHAT IT SAYS, in his order: an adapter may overheat; it is the owner's
 * own risk; what to do if one does. Then what stays cool and why, and what
 * happened here, as what happened and what owners report, never as a fact
 * about the FM3's hardware, and with no home-made way round it (see the
 * head of this file). Never that anything was "tried" ("We don't need to
 * mention really whether or not something has been tested or not", Justin,
 * 31 October 2026), and never that an adapter "works": what has run where
 * is ours (TRIED_NOTES).
 *
 * WITH "EVEN ON USB POWER", as the guide has it: without it the owner of a
 * WIDI Jack on a USB charger read the warning as not about their adapter.
 */
export const FM3_WARNING =
  'On an FM3, a Bluetooth adapter may overheat. Use one at your own risk, and unplug it if it gets hot. The WIDI Uhost with a CME U2MIDI Pro runs on USB power only, and stays cool. A WIDI Master and a C2MIDI Pro both got very hot on an FM3 and did not work, and FM3 owners report heat with other adapters that take power from its MIDI OUT, even on USB power.'

/** The units the parts list must not be bought for as it is: none since the FM3 has the U2MIDI Pro (26 October 2026). */
export const NOT_STRAIGHT_IN = []

/*
 * WHICH ADAPTER IT IS, BY THE NAME A PHONE LISTS IT BY ("WIDI Master",
 * "WIDI Jack Bluetooth", "WIDI Uhost", "MD-BT01"), case and spaces not
 * counted: the way of the guide it belongs to (waysFor's keys), or null for
 * one the app has no way for. A WIDI renamed by its owner is the owner's to
 * know. It decides one thing only: which adapter's tab How to connect and
 * Troubleshooting open on. NOTHING IS REFUSED BY IT: until 15 November 2026
 * these names were a list of adapters never picked, offered or switched to
 * for an FM3 (FM3_NEVER_NAMES, neverOnFm3, namedForFm3).
 */
export const ADAPTER_NAMES = Object.freeze({ master: /widi\s*master/i, jack: /widi\s*jack/i, uhost: /widi\s*uhost/i, mdbt01: /md-?\s*bt01/i })
export const adapterKind = (name) => Object.keys(ADAPTER_NAMES).find((kind) => ADAPTER_NAMES[kind].test(String(name || ''))) || null

/*
 * NOT AN ADAPTER: A MIDI FOOTSWITCH THAT TALKS BLUETOOTH MIDI.
 *
 * "Hey, can it do MVAVe chocolate midi's?" (a customer's report, 8 November
 * 2026, FM3): his phone had connected to the M-VAVE Chocolate Plus itself,
 * "FootCtrlPlus Bluetooth", as if it were the adapter on the unit, and the
 * FM3 never answered. A footswitch sends its own buttons; nothing documents
 * one carrying the app's messages to a unit or the unit's answers back. The
 * phone lists every Bluetooth MIDI device, so one like this is never picked
 * by itself (bluetooth.js pickRule), and once connected the page says what it
 * is rather than sending the player to check the plugs. FootCtrl is the
 * original Chocolate, FootCtrlPlus the Plus (M-VAVE's own firmware names). A
 * name is added here only once a report shows it.
 */
export const NOT_ADAPTER_NAMES = Object.freeze([/^\s*foot\s*ctrl/i])
export const notAnAdapter = (name) => NOT_ADAPTER_NAMES.some((re) => re.test(String(name || '')))

/*
 * STILL NOT CONNECTING AFTER THE ADAPTER WAS UNPLUGGED AND PLUGGED BACK IN.
 * "I had to force close the app after Bluetooth was connected, and when I
 * unplugged the device and plugged it back in. The Bluetooth wouldn't
 * connect again until I Force quit the app" (26 October 2026). His log
 * says the iPhone still listed the adapter as there, so the app connected
 * to it at once, and the unit never answered; the launch after the force
 * quit answered in a twentieth of a second. What is held stale is below the
 * JavaScript (the phone's own MIDI connection, made once per launch), so
 * the way out until a store build changes that is the player's: said on
 * the page wherever it is not connecting, and in the guide.
 *
 * AND THE ADAPTER FIRST, SAID OUTRIGHT (13 November 2026). The line used to
 * open "Still not connecting after unplugging and plugging the adapter back
 * in?", which took for granted a step nothing on the page had told anybody
 * to take. "Bluetooth isn't connecting for some reason ... I got Bluetooth
 * reconnected I just restarted the device the Bluetooth device. I don't
 * know if that's in troubleshooting it or not, but it should be." (Justin,
 * that day.) So the first sentence is the step itself, and closing the app
 * is what comes after it.
 */
export const CLOSE_AND_REOPEN =
  'Not connecting? Unplug the Bluetooth adapter for a few seconds and plug it back in. Still nothing? Close the app completely (swipe it away) and open it again.'

/*
 * NO HEAT CHECK BUT THE FM3'S. Each untried way said "In the first minute,
 * feel the adapter" until 31 October 2026: "The FM three is the only one
 * that ever has overheating issues so we don't need to worry about it for
 * any other devices." The FM3 keeps its warning (FM3_WARNING, FM3_SHORT),
 * red and in front, and its two ways that take power from MIDI OUT say to
 * feel the adapter (FM3_FEEL).
 */

/*
 * PROGRAM CHANGE FIRST, ON THE FM9 AND AXE-FX III. Fractal publishes no SysEx
 * preset switch for any of its units: the III's manual names "Controller 0 +
 * PC" as the way presets are picked over MIDI, and the FM9's and FM3's say
 * the same. The 0x27 frame the phone sends an FM3 first is FM3-Edit's, seen
 * working on an FM3 and nowhere else, so on these two the phone sends only
 * the documented way (bleWire trialPreset), and the settings that way needs
 * are one of the steps, not a line for some owners: Program Change On, the
 * MIDI channel the phone sends on (1, or Omni), PC Mapping Off (with it on,
 * the III's manual says, "MIDI BANK SELECT messages are ignored"). And Send
 * Realtime Sysex On, which is how the tuner's readings reach the phone: the
 * published tuner switch (0x11) turns it on and off, and the readings come
 * only with that setting on ("this data ONLY streams over the MIDI Out
 * jack", Fractal's third-party MIDI document, Rev 1.4).
 */
export const PC_FIRST = ['fm9', 'axefx3']

/*
 * THE MIDI CHANNEL, ONLY IF PRESETS DON'T CHANGE. On the FM3, a preset goes
 * first by the unit's own SysEx switch, and by Program Change on channel 1 (bleWire's
 * pcChannel) only when that does not land (trialPreset), so most owners
 * never need this, and moving the MIDI channel or turning PC Mapping off
 * changes how their own foot controller works on the unit. So it is said
 * as the guide says it, with its condition first ("if presets don't change
 * from the phone: ... set Program Change on, the MIDI channel to 1 or Omni,
 * and PC Mapping off"), under the steps and not one of them: until 25
 * October 2026 it was the last step, for every owner, and took the place of
 * the FM9's plain MIDI Thru step. Every Gen 3 unit's, the FM3's included for
 * the day it has steps again; the AM4's presets never go by Program Change.
 * Not the FM9's or the Axe-Fx III's since the build-out of 25 October 2026:
 * their presets go by Program Change alone, so the settings are one of their
 * steps (PC_FIRST, above).
 * The device in hand named by `noun`.
 */
export const midiSettingsFor = (unit, noun = 'phone') => {
  const name = UNITS[unit]
  /* The FM9 and Axe-Fx III have these in their steps (UNIT_SETTINGS): their presets go by Program Change alone. */
  if (!name || unit === 'am4' || unit === 'vp4' || PC_FIRST.includes(unit)) return null
  return `If presets don’t change from this ${noun}: on the ${name}, open Setup → MIDI/Remote and set Program Change to On, the MIDI channel to 1 (or Omni), and PC Mapping to Off.`
}

/** The warning to show for a unit instead of its parts and steps, or null. */
export const warningFor = (unit) => (unit === 'fm3' ? FM3_WARNING : null)

/**
 * What to buy for one unit, in the order it plugs together, each part's line
 * said for the device in hand (`noun`). None for a unit that is warned about.
 */
export function partsFor(unit, noun = 'phone') {
  if (NOT_STRAIGHT_IN.includes(unit)) return []
  const keys = unit === 'am4' || unit === 'vp4' ? ['uhost', 'c2midi', 'adapters'] : unit === 'fm3' ? ['uhost', 'u2midi'] : ['uhost', 'c2midi']
  return keys.map((key) => {
    const p = PARTS[key]
    return { key, ...p, does: typeof p.does === 'function' ? p.does(noun) : p.does }
  })
}

/*
 * UNDER THE PARTS: WHO MAKES THEM, AND THAT THIS APP IS NOT THEM. The guide
 * has said it since the parts went on it ("Fractal Remote gets nothing from
 * them", and not connected with CME, LOOTOOLS or any seller), and the app's
 * View on Amazon buttons said nothing. Customers press those buttons now.
 *
 * Without the word "connected", which the guide can keep: on this page it is
 * the Bluetooth link ("Connected · AM4 answering", "Not connected"), and
 * "isn't connected with them" under a CME adapter read as the app failing to
 * reach it.
 */
export const SELLERS_LINE = 'CME, Yamaha, LOOTOOLS, Eldraqth and Anker make these parts. Fractal Remote has nothing to do with them or with Amazon, and gets nothing from these links.'

/*
 * ONE THING TALKING TO THE UNIT. With Bluetooth on, the phone never looks
 * for the computer, but the unit can still be on its USB cable to a computer
 * running the Fractal Remote app, and nobody has tried the two driving it at
 * once (the AM4 has frozen on messages it did not expect). Until someone
 * has, one or the other: said under the steps, and on the guide.
 */
export const ONE_AT_A_TIME =
  'While you use Bluetooth, quit the Fractal Remote app on the computer, or unplug the unit’s USB cable, so the unit isn’t driven from two places at once.'

/** Whether it has been tried on this unit. */
export const triedOn = (unit) => TESTED.includes(unit)

/**
 * BEFORE THE FIRST TIME: THE UHOST'S FIRMWARE. CME asks for it before first
 * use, and so does the Amazon listing ("Update firmware via WIDI App
 * first"). It matters more here than for most: the app reads the unit's
 * names and answers in long messages, and the Uhost's USB firmware only
 * passed those whole from v37 on ("Supports unlimited sysex messages").
 * One that has never been updated can leave the unit "not answering", or its
 * names garbled, with every plug in the right place. Then the WIDI app is
 * closed, because the Uhost connects to one thing at a time and the WIDI app
 * would keep hold of it. Its own line, said before the steps, not one of
 * them: it is done once, with the Uhost on its own, and the steps stay five
 * or fewer.
 */
export const FIRST_TIME =
  'Before the first time: update the Uhost in CME’s free WIDI app (both its USB and its Bluetooth firmware, about two minutes each), then close the WIDI app. The full setup guide says how.'

/** Under the parts: the one thing to plug in that is not on the list. */
export const POWER_LINE = 'And a phone charger or power bank, with a USB-C cable, to power the Uhost.'

/** When the adapter is connected and the unit says nothing: the usual reason, with these parts. */
export const PLUGS_CHECK =
  'With the C2MIDI Pro or the U2MIDI Pro, the black plug goes in the unit’s MIDI IN and the white one in MIDI OUT. Swapped, nothing gets through.'

/*
 * Before a unit is picked: the whole of it in two lines. The FM3 is not in
 * it: its own warning is drawn once it is picked. One list for everybody since 25 October 2026, when a customer
 * stopped being offered the AM4 alone (it had a list of its own,
 * GEAR_IN_SHORT_AM4, until then).
 */
export const GEAR_IN_SHORT =
  'A CME WIDI Uhost, a CME C2MIDI Pro, and a phone charger or power bank with a USB-C cable for the Uhost. For an AM4 or VP4, also two Type-A MIDI to 3.5 mm adapters. Pick your unit above for where to buy them and how they plug in.'

/**
 * How it plugs together, for one unit, in at most five short steps, the
 * device in hand named by `noun`.
 *
 * The MIDI side first and the power last, so the unit is already on and
 * started when the Uhost wakes up. Null for a unit this does not know.
 */
export function hookupFor(unit, noun = 'phone') {
  const name = UNITS[unit]
  if (!name || NOT_STRAIGHT_IN.includes(unit)) return null
  const usb = 'Plug the C2MIDI Pro’s USB-C plug into the Uhost’s left socket, marked USB Host/Device.'
  const power = powerStep(name)
  if (unit === 'am4') {
    return [
      'Push one 3.5 mm adapter into the AM4’s MIDI IN, and the other into its MIDI OUT.',
      'C2MIDI Pro: the black plug (TO MIDI IN) into the adapter in MIDI IN, and the white plug (TO MIDI OUT) into the adapter in MIDI OUT.',
      usb,
      power,
      'On the AM4, open Setup → MIDI/Remote and set MIDI Thru to Off.'
    ]
  }
  /*
   * THE VP4: ONE PLUG, ONE WAY. The app only ever sends a VP4 its presets
   * and scenes over Bluetooth, and reads nothing back (lib/bleVp4.js), so
   * only the black plug goes in, through one adapter, into its MIDI IN, and
   * the white plug, the one that can take power from a unit's MIDI OUT, is
   * left out. And its own MIDI settings, in its own manual's words: Receive
   * MIDI PC ON, and the channel (lib/vp4-safety, VP4_SETUP).
   */
  if (unit === 'vp4') {
    return [
      'Push one 3.5 mm adapter into the VP4’s MIDI IN.',
      `C2MIDI Pro: the black plug (TO MIDI IN) into that adapter. Leave the white plug out: the app only sends to a VP4, and nothing comes back over Bluetooth.`,
      usb,
      power,
      'On the VP4, open SETUP > MIDI/Remote and set Receive MIDI PC to ON, and the MIDI Channel to 1 (or OMNI). For scenes, set Scene Select too: Settings > VP4 scenes & presets says how.'
    ]
  }
  /*
   * THE FM3: the U2MIDI Pro in the C2MIDI Pro's place, the way it was tried
   * and worked (26 October 2026). Its plugs are marked as the C2MIDI Pro's
   * are, and its USB-A plug needs an adapter to go in the Uhost.
   */
  if (unit === 'fm3') {
    return [
      'U2MIDI Pro: the black plug (TO MIDI IN) into the FM3’s MIDI IN.',
      'The white plug (TO MIDI OUT) into its MIDI OUT/THRU jack.',
      'Plug the U2MIDI Pro’s USB plug into the Uhost’s left socket, marked USB Host/Device, through a USB-C to USB-A adapter.',
      power,
      unitSettingsStep(unit)
    ]
  }
  if (unit === 'axefx3') {
    return [
      'C2MIDI Pro: the black plug (TO MIDI IN) into the Axe-Fx III’s MIDI IN.',
      `The white plug (TO MIDI OUT) into its MIDI OUT. Not THRU: the ${noun} would only hear itself there.`,
      usb,
      power,
      unitSettingsStep(unit)
    ]
  }
  return [
    `C2MIDI Pro: the black plug (TO MIDI IN) into the ${name}’s MIDI IN.`,
    `The white plug (TO MIDI OUT) into its MIDI OUT/THRU jack.`,
    usb,
    power,
    unitSettingsStep(unit)
  ]
}

/*
 * THE UNIT'S OWN SETTINGS, ONE STEP. The FM9 and the Axe-Fx III take
 * presets by Program Change alone and send tuner readings only with Send
 * Realtime Sysex on (PC_FIRST, above), so those go in the one step that
 * sends the player into the unit's menus, after MIDI Thru on the FM9. The
 * III has no MIDI Thru setting: its THRU jack is hardware, and the plug
 * stays out of it (the step before). Any other unit with steps here (none
 * today) keeps the plain MIDI Thru step.
 */
function unitSettingsStep(unit) {
  const name = UNITS[unit]
  const rest = 'Program Change to On, the MIDI channel to 1 (or Omni), PC Mapping to Off, MIDI PC Offset to 0, and Send Realtime Sysex to On.'
  if (unit === 'axefx3') return `On the ${name}, open Setup → MIDI/Remote and set ${rest}`
  if (unit === 'fm9') return `On the ${name}, open Setup → MIDI/Remote and set MIDI Thru to Off, ${rest}`
  return `On the ${name}, open Setup → MIDI/Remote and set MIDI Thru to Off.`
}

/* The power step, the same words for every unit: the Uhost's power goes in last, with the unit already on. */
const powerStep = (name) =>
  `With the ${name} already on, plug a phone charger or power bank into the Uhost’s right socket, marked USB Power (5 volts, nothing stronger). The Uhost needs this power to work.`

/*
 * THE WAYS TO HOOK IT UP, BY UNIT, best first. "On the AM4 and VP4, show the
 * WIDI Master first, as that's a single device that can get them set up. And
 * then the alternative devices would be the WIDI Jack with TRS connectors, or
 * the WIDI Uhost ... On the FM3 just show the WIDI Uhost setup with the
 * U2MIDI Pro ... On the FM9 and Axe-Fx III show the WIDI Master OR the WIDI
 * Jack with 5-pin connector OR the WIDI Uhost with the C2MIDI Pro" (Justin,
 * 26 October 2026). Each way: its key (the adapter it is: adapterKind's
 * word for it), the short name on its tab (`tab`), its title, a word on why
 * it is first where it is (`sub`), its parts (by PARTS key), the line about
 * its firmware before the first time (`before`, none for an adapter with
 * nothing to update), its steps, a caution of its own (`caution`), and
 * whether the app has run on this unit through it (`tried`: ours, for the
 * Developer page, never said to a customer).
 *
 * ONE ADAPTER AT A TIME ON THE SCREEN, since 15 November 2026: "let's add
 * Bluetooth device specific as well as the fractal units specific trouble
 * shooting with tabs so we don't have to sort through so much information
 * not relevant to the unit and device they are using" (Justin). How to
 * connect draws these as tabs under the units (they were fold-out "Option
 * 1, Option 2" rows, every one on the page), and Troubleshooting has the
 * same tabs (adapterTabsFor, troubleFor).
 *
 * THE FM3 HAS THREE WAYS SINCE THAT DAY (see A WARNING, NOT A NEVER, at the
 * head of this file): the Uhost and a U2MIDI Pro first, which runs on USB
 * power only and stays cool; then Yamaha's MD-BT01 and the WIDI Jack, which
 * take their power from its MIDI OUT, each with the caution to feel it
 * (FM3_FEEL), the Jack's saying it gets hot there. Not the WIDI Master, nor
 * the Uhost with a C2MIDI Pro: on his FM3 both got very hot and neither
 * worked, so there is nothing to offer. An FM3 owner who has one can still
 * connect through it: nothing is refused by name any more.
 *
 * THE YAMAHA MD-BT01 on the three units with 5-pin jacks it plugs straight
 * into (FM3, FM9, Axe-Fx III). Not on an AM4 or VP4, whose 3.5 mm jacks it
 * would need adapters for that nobody has had on one.
 */
/* The WIDI Jack on an AM4 since 28 October 2026: "WIDI jack works perfectly with AM4". On an FM3, a customer's MD-BT01 and WIDI Jack (15 November 2026). */
const TRIED_WAYS = { am4: ['master', 'jack', 'uhost'], fm3: ['uhost', 'mdbt01', 'jack'] }

/** The name on each adapter's tab, and the one for an adapter the app has no way for (Troubleshooting's last tab). */
export const ADAPTER_TABS = Object.freeze({ master: 'WIDI Master', jack: 'WIDI Jack', uhost: 'WIDI Uhost', mdbt01: 'Yamaha MD-BT01', other: 'Another adapter' })

/* On an FM3, under a way that takes its power from MIDI OUT: the one heat check the app still asks for (NO HEAT CHECK BUT THE FM3'S, above). */
export const FM3_FEEL = 'It takes its power from the FM3’s MIDI OUT. Feel it in the first few minutes, and unplug it if it gets hot.'
export const FM3_JACK_HOT = `A WIDI Jack gets hot on an FM3. ${FM3_FEEL}`

const thruOff = (name) => `On the ${name}, open Setup → MIDI/Remote and set MIDI Thru to Off.`
const masterPower = (name) => `It takes its power from the ${name}’s MIDI OUT: with the ${name} on, its light comes on. It has no other way to be powered.`
const jackPower = (name) => `It takes its power from the ${name}’s MIDI OUT. If its light stays off, plug a phone charger or power bank into the Jack’s USB-C socket.`
/* Yamaha's manual: "Turn on the instrument. The lamp of the MD-BT01 flashes", and "Power: MIDI OUT". */
const mdPower = (name) => `It takes its power from the ${name}’s MIDI OUT: with the ${name} on, its lamp flashes. It has no other way to be powered.`
const swapIfQuiet = 'If the unit doesn’t answer, swap the two plugs.'

export function waysFor(unit, noun = 'phone') {
  const name = UNITS[unit]
  if (!name) return []
  const uhost = (parts, more = {}) => ({ key: 'uhost', tab: ADAPTER_TABS.uhost, title: 'WIDI Uhost and a cable', parts, before: FIRST_TIME, steps: hookupFor(unit, noun), powerAt: powerStepOf(unit), ...more })
  if (unit === 'am4' || unit === 'vp4') {
    const vp4 = unit === 'vp4'
    return mark(unit, [
      {
        key: 'master',
        tab: ADAPTER_TABS.master,
        title: 'WIDI Master',
        sub: 'The simplest',
        parts: ['master', 'masterAdapters'],
        before: FIRST_TIME_ADAPTER,
        steps: [
          `Push one 3.5 mm adapter into the ${name}’s MIDI IN, and the other into its MIDI OUT.`,
          `Plug the WIDI Master’s two MIDI plugs into the two adapters, as the labels on its plugs say. ${swapIfQuiet}`,
          masterPower(name),
          vp4 ? vp4Settings : thruOff(name)
        ],
        powerAt: 2
      },
      {
        key: 'jack',
        tab: ADAPTER_TABS.jack,
        title: 'WIDI Jack with 3.5 mm cables',
        parts: ['jackTrs'],
        before: FIRST_TIME_ADAPTER,
        steps: [
          'Set the switch on the WIDI Jack to Type A.',
          `Plug its two cables into the Jack, then their 3.5 mm plugs into the ${name}’s MIDI IN and MIDI OUT, as the labels say. ${swapIfQuiet}`,
          jackPower(name),
          vp4 ? vp4Settings : thruOff(name)
        ],
        powerAt: 2
      },
      uhost(['uhost', 'c2midi', 'adapters'])
    ])
  }
  /* The three units with 5-pin jacks. */
  const out = unit === 'axefx3' ? `its MIDI OUT (not THRU: the ${noun} would only hear itself there)` : 'its MIDI OUT/THRU jack'
  const settings = hookupFor(unit, noun).at(-1)
  const master = {
    key: 'master',
    tab: ADAPTER_TABS.master,
    title: 'WIDI Master',
    sub: 'The simplest',
    parts: ['master'],
    before: FIRST_TIME_ADAPTER,
    steps: [`Plug the WIDI Master’s two MIDI plugs into the ${name}’s MIDI IN and ${out}, as the labels on its plugs say. ${swapIfQuiet}`, masterPower(name), settings],
    powerAt: 1
  }
  const jack = {
    key: 'jack',
    tab: ADAPTER_TABS.jack,
    title: 'WIDI Jack with 5-pin cables',
    parts: ['jackDin'],
    before: FIRST_TIME_ADAPTER,
    steps: [`Plug its two cables into the Jack, then their 5-pin plugs into the ${name}’s MIDI IN and ${out}, as the labels say. ${swapIfQuiet}`, jackPower(name), settings],
    powerAt: 1
  }
  /* Yamaha's manual: "connect the MD-BT01 to the MIDI terminals ... Make sure to match the arrow directions as shown." It has no app to update it with. */
  const mdbt01 = {
    key: 'mdbt01',
    tab: ADAPTER_TABS.mdbt01,
    title: 'Yamaha MD-BT01',
    parts: ['mdbt01'],
    before: null,
    steps: [`Plug the MD-BT01’s two plugs into the ${name}’s MIDI IN and ${out}, matching the arrows on its plugs. ${swapIfQuiet}`, mdPower(name), settings],
    powerAt: 1
  }
  if (unit === 'fm3') {
    return mark(unit, [uhost(['uhost', 'u2midi', 'usbA'], { sub: 'Stays cool on an FM3' }), { ...mdbt01, caution: FM3_FEEL }, { ...jack, caution: FM3_JACK_HOT }])
  }
  return mark(unit, [master, jack, uhost(['uhost', 'c2midi']), mdbt01])
}

/* The VP4's own settings step, in its manual's words (the same as hookupFor's). */
const vp4Settings = 'On the VP4, open SETUP > MIDI/Remote and set Receive MIDI PC to ON, and the MIDI Channel to 1 (or OMNI). For scenes, set Scene Select too: Settings > VP4 scenes & presets says how.'

/* Which ways have run on this unit: for the Developer page (BluetoothTried), never said to a customer. */
function mark(unit, ways) {
  return ways.map((w) => ({ ...w, tried: (TRIED_WAYS[unit] || []).includes(w.key) }))
}

/*
 * TROUBLESHOOTING, BY UNIT AND BY ADAPTER. It was one list for everybody,
 * with every adapter's line in it ("The WIDI Uhost needs a phone charger ...
 * A WIDI Master, or a WIDI Jack with no charger, lights up from the unit's
 * MIDI OUT ... With the C2MIDI Pro or the U2MIDI Pro, the black plug ...
 * With a WIDI Master or WIDI Jack, swap its two plugs ... update the Uhost
 * in CME's free WIDI app"), whatever was plugged in. "So we don't have to
 * sort through so much information not relevant to the unit and device they
 * are using" (Justin, 15 November 2026): the page has the units and the
 * unit's adapters as tabs now, and these are the lines that are an
 * adapter's own, for one unit. What is the same for every adapter (the
 * device's Bluetooth, the unit's settings, closing the app, the range) is
 * the page's (screens/Bluetooth BluetoothTrouble).
 *
 * `kind` is a way's key (waysFor), or 'other' for an adapter the app has no
 * way for, which gets the lines true of any of them. Each answer: `lit`
 * (its light, and what powers it), `plugs` (which plug goes where on THIS
 * unit, in the adapter's own words: a WIDI Master has no white plug), `typeA`
 * (an AM4's or VP4's 3.5 mm jacks, where it applies) and `before` (the
 * firmware line, for an adapter that has one).
 */
/* The tabs Troubleshooting and How to connect draw for a unit: its ways, and on Troubleshooting one more for any other adapter. */
export const adapterTabsFor = (unit, { other = false } = {}) => [...waysFor(unit).map((w) => ({ key: w.key, label: w.tab })), ...(other ? [{ key: 'other', label: ADAPTER_TABS.other }] : [])]

/* The other half of the quiet-unit hint, for an adapter with no way of its own here: one that only carries one way. */
/**
 * WHICH ADAPTER TAB SHOWS. The one tapped, while the unit picked still has
 * it; else the tab of the adapter kept from last time, by its name; else,
 * for a kept adapter the unit has no tab for (one of another make, or a WIDI
 * Master kept for an FM3), the tab for any other adapter, where the page has
 * one; else the first. Pure, so a test runs it: a tab is only ever a view,
 * and picking one never changes what the app connects to.
 *
 * @param {{ key: string }[]} tabs
 * @param {{ asked?: string|null, name?: string|null }} [how] the tab tapped, and the kept adapter's name
 */
export const adapterTabFor = (tabs, { asked = null, name = null } = {}) => {
  const has = (key) => !!key && tabs.some((t) => t.key === key)
  if (has(asked)) return asked
  const kind = adapterKind(name)
  if (has(kind)) return kind
  if (name && has('other')) return 'other'
  return tabs[0]?.key ?? null
}

export const BOTH_WAYS = 'The adapter has to carry MIDI both ways. One with a single plug, in one MIDI jack, only carries one way: use one with two plugs, in the unit’s MIDI In and MIDI Out.'

/* A WIDI Master's two plugs, in its own words (see A WIDI MASTER HAS NO WHITE PLUG, below). */
const masterBoth = (unit) =>
  `A WIDI Master needs both of its plugs in: the larger one, with the light, in MIDI OUT${unit === 'axefx3' ? ' (not THRU)' : ''}, and the small one in MIDI IN, with its thin cable pushed all the way into the larger plug.`

/**
 * TROUBLESHOOTING'S OWN LINES FOR ONE ADAPTER ON ONE UNIT: the ones that
 * differ by adapter. Its light and where its power comes from (`lit`), where
 * its plugs go and what to do if nothing gets through (`plugs`), Type A on
 * the two units with 3.5 mm jacks (`typeA`), and its firmware, where it has
 * an app to update it with (`before`). The page puts them among the lines
 * that are true of every adapter (screens/Bluetooth BluetoothTrouble).
 *
 * Until 15 November 2026 the list named every adapter at once ("Check the
 * adapter is lit: the Uhost needs …, a WIDI Master or WIDI Jack lights up
 * from …"). "So we don't have to sort through so much information not
 * relevant to the unit and device they are using" (Justin): a line here
 * names its own adapter and its own unit and no other, and a test holds it
 * (test/bluetooth-tabs.mjs).
 *
 * @param {string|null} unit  the unit picked, or null for none yet
 * @param {string|null} kind  a key of ADAPTER_TABS; anything else reads as 'other'
 * @param {string} [noun]     the device in hand (shared/device-word)
 * @returns {{ lit: string, plugs: string, typeA: string|null, before: string|null }}
 */
export function troubleFor(unit, kind, noun = 'phone') {
  const name = UNITS[unit] || 'unit'
  const small = unit === 'am4' || unit === 'vp4'
  const vp4 = unit === 'vp4'
  /* A VP4 sends nothing back over Bluetooth, so "doesn't answer" is not something its owner can see: presets not changing is. */
  const quiet = vp4 ? 'If presets don’t change on the VP4' : `If the ${name} doesn’t answer`
  const jacks = unit === 'axefx3' ? 'MIDI IN and MIDI OUT (never THRU)' : small ? 'MIDI IN and MIDI OUT' : 'MIDI IN and MIDI OUT/THRU'
  const fromOut = (what) => `Check the ${what} is lit. It lights up from the ${name}’s MIDI OUT once the ${name} is on.`
  if (kind === 'uhost') {
    const cable = unit === 'fm3' ? 'U2MIDI Pro' : 'C2MIDI Pro'
    return {
      lit: 'Check the Uhost is lit. It needs a phone charger or power bank in its right socket, USB Power (5 volts, nothing stronger).',
      plugs: vp4
        ? `With the ${cable}, only the black plug goes in: into the adapter in the VP4’s MIDI IN. The white plug stays out.`
        : small
          ? `With the ${cable}, the black plug goes in the adapter in the ${name}’s MIDI IN and the white one in the adapter in its MIDI OUT. Swapped, nothing gets through.`
          : `With the ${cable}, the black plug goes in the ${name}’s MIDI IN and the white one in ${unit === 'axefx3' ? 'MIDI OUT (never THRU)' : 'MIDI OUT/THRU'}. Swapped, nothing gets through.`,
      typeA: small ? TYPE_A : null,
      before: FIRST_TIME
    }
  }
  if (kind === 'master') {
    return {
      lit: `${fromOut('WIDI Master')} It has no other way to be powered.`,
      plugs: `${masterBoth(unit)} ${quiet}, swap the two plugs.`,
      typeA: small ? TYPE_A : null,
      before: FIRST_TIME_ADAPTER
    }
  }
  if (kind === 'jack') {
    return {
      lit: `${fromOut('WIDI Jack')} If it stays dark, plug a phone charger or power bank into the Jack’s USB-C socket.`,
      plugs: `Its two cables go in the ${name}’s ${jacks}, as their labels say. ${quiet}, swap the two plugs.`,
      typeA: small ? 'The switch on the WIDI Jack has to be set to Type A.' : null,
      before: FIRST_TIME_ADAPTER
    }
  }
  if (kind === 'mdbt01') {
    return {
      lit: `Check the MD-BT01’s lamp. It flashes once the ${name} is on, and stays lit once this ${noun} has connected to it. It takes its power from the ${name}’s MIDI OUT and has no other way to be powered.`,
      plugs: `Its two plugs go in the ${name}’s ${jacks}, matching the arrows on them. ${quiet}, swap the two plugs.`,
      typeA: small ? TYPE_A : null,
      before: null
    }
  }
  return {
    lit: 'Check the adapter is lit, and has the power it needs.',
    /* A VP4 is only ever sent to (lib/bleVp4), so "both ways" is not its rule: its Uhost steps leave the white plug out. What has to be reached is its MIDI IN. */
    plugs: vp4
      ? 'The adapter has to reach the VP4’s MIDI IN: the app only sends to a VP4, and nothing comes back over Bluetooth. If presets don’t change on the VP4 and the adapter has two plugs, swap them.'
      : `${BOTH_WAYS}${unit === 'axefx3' ? ' On an Axe-Fx III that is MIDI OUT, never THRU.' : ''} ${quiet}, swap the two plugs.`,
    typeA: small ? `The ${name}’s MIDI jacks are small 3.5 mm ones: an adapter or cable for them has to be Type A.` : null,
    before: null
  }
}

/* An AM4's or VP4's two 3.5 mm adapters (PARTS adapters, masterAdapters: "They must be Type A"). */
const TYPE_A = 'The two 3.5 mm adapters have to be Type A. Type B won’t work.'

/* Before the first time, on a WIDI Master or Jack: CME's firmware, as FIRST_TIME says for the Uhost. */
export const FIRST_TIME_ADAPTER = 'Before the first time: update the adapter in CME’s free WIDI app, then close the WIDI app.'

/** Where the power goes in among a unit's steps (hookupFor), counting from 0: the heat line is drawn straight after it. -1 for a unit with no steps. */
export const powerStepOf = (unit) => (hookupFor(unit) || []).indexOf(powerStep(UNITS[unit]))

/*
 * WHETHER A UNIT IS ONE NOBODY HAS RUN IT ON: ours to know, never said to
 * its owner. Until 31 October 2026 it put "Not tried yet" on the unit's
 * button, under "Connected", in What Bluetooth can't do, under Play's pill
 * and on a fault card ("On any units that haven't been tried ... just
 * mention that they haven't been tried", 25 October 2026). Then: "we don't
 * need to mention really whether or not something has been tested or not,
 * we just need to keep track of it ourselves in the developer menu". So it
 * decides only the Developer page's list and a report's log head.
 */
export const untried = (unit) => !!UNITS[unit] && !triedOn(unit)

/** The unit's name as a report's log head says it: "VP4 (not tried yet)", "AM4". */
export const unitForReport = (unit) => (UNITS[unit] ? `${UNITS[unit]}${!untried(unit) ? '' : ' (not tried yet)'}` : null)

/*
 * WHAT A VP4 GETS OVER BLUETOOTH, wherever it is the unit picked: What it can
 * and can't do on the Bluetooth page, in place of the line for the other
 * units, and on Play in place of the chain the phone cannot read (Stage, a
 * VP4 over Bluetooth). Presets and scenes, by the two messages a foot
 * controller sends, and nothing read back (lib/bleVp4.js): no effects, no
 * names, no tuner, and nothing to say a preset or scene landed.
 *
 * AND WHAT THE COMPUTER ADDS FOR ONE, said as only what it does (shared/
 * vp4-safety.mjs, the computer's own sentences): its effects turned on and
 * off, the name of the preset it is on, and a check that a preset or scene
 * landed. Never the tuner: until 7 November 2026 this sent VP4 owners to
 * the computer for "effects, names or tuner", and a VP4's tuner does not
 * open from the app at all (VP4_NO_TUNER, VP4_SO_FAR).
 */
export const VP4_OVER_BLUETOOTH =
  'Over Bluetooth, the app changes a VP4’s presets and scenes, the way a MIDI foot controller does, and nothing else. It can’t hear the VP4 that way, so it can’t show its effects or the name of the preset it is on, or check that a preset or scene landed. Through the computer, the app also turns its effects on and off, shows that name, and checks that a preset or scene landed.'

/* And under "Connected" on the page: the adapter is all a VP4's link can know. */
export const VP4_CONNECTED = 'Connected · sending to the VP4'
export const VP4_CANT_HEAR =
  'The app can’t hear a VP4 over Bluetooth, so this only says the adapter is connected. If presets don’t change, check the black plug is in the VP4’s MIDI IN, and on the VP4 that SETUP > MIDI/Remote has Receive MIDI PC ON.'

/*
 * THE BLOCKS PLAY DOES NOT DRAW YET, on the units that have them: none, now,
 * so this answers null for every unit and the page draws no line (it draws
 * the bullet only for a sentence).
 *
 * Fractal's Blocks Guide (June 2023) gives the FM9 and Axe-Fx III blocks the
 * FM3 has none of: Crossover, Vocoder and Tone Match on both, and IR Player
 * and Dynamic Distortion on the III alone. While Play left them out, the
 * page said so here, rather than leave an owner looking for a block that is
 * in the preset: "A few blocks the FM3 doesn't have (…) aren't shown on Play
 * yet." Over Bluetooth, which is all this line speaks for, Play has drawn
 * and switched the III's IR Player and its NAM (firmware 33) since 1.89.73,
 * and the rest since 1.90.47 (mobile/src/lib/gen3Catalog.js OWN, with where
 * each id came from).
 *
 * Kept, with its table empty, for the next block a unit gets before the app
 * does: a sentence under the unit's key is on the page again. It never
 * names the RTA, which has no on and off and is not a block Play would draw
 * (gen3Catalog NOT_BLOCKS).
 */
const MISSING_BLOCKS = Object.freeze({})
export function missingBlocksLine(unit) {
  return MISSING_BLOCKS[unit] || null
}

/*
 * THE TUNER WITH NO READINGS, on the FM9 and Axe-Fx III. The phone turns
 * their tuner on with Fractal's published switch (0x11), and the readings
 * come only with Send Realtime Sysex on (Setup → MIDI/Remote). Whether that
 * setting starts on, Fractal does not say. The phone never falls back to
 * asking for the frequency, which Fractal has not published for these two.
 */
export const tunerQuietLine = (unit) =>
  PC_FIRST.includes(unit)
    ? `No readings from the ${UNITS[unit]} yet. Play a string; if nothing shows, check that Send Realtime Sysex is On (Setup → MIDI/Remote on the ${UNITS[unit]}). Until then, use the ${UNITS[unit]}’s own display.`
    : null

/*
 * THE ADAPTER IS CONNECTED AND THE UNIT SAYS NOTHING. On the AM4, FM3 and FM9
 * the usual reasons are the plugs and MIDI Thru. The Axe-Fx III has no MIDI
 * Thru setting; its THRU jack is hardware and only repeats what comes in, so
 * a white plug there hears the phone and never the unit (its manual: "Messages
 * received at the MIDI IN port are passed automatically to the MIDI THRU
 * port").
 *
 * A WIDI MASTER HAS NO WHITE PLUG, AND ITS SECOND PLUG IS EASY TO LEAVE OUT.
 * A customer's report (14 November 2026: an Axe-Fx III, an iPhone, a WIDI
 * Master) showed the adapter connected and not one byte back, through every
 * Connect again for twenty minutes, and all the app said was "the white one
 * goes in MIDI OUT": the C2MIDI Pro's colours, on an adapter with two dark
 * plugs. A WIDI Master is two pieces, the larger one with the light, which
 * takes its power from MIDI OUT (so it connects to the phone with only that
 * one in), and a small one on a thin cable for MIDI IN, which CME calls
 * optional because a keyboard that only sends does not need it. This app
 * needs both: with the small one out, the unit never hears the phone, and
 * nothing at all comes back, which is exactly that log. So its line names
 * its own two plugs. (What that rig really was is not known; this is the
 * reading that fits a first setup with one adapter.)
 */
export const isWidiMaster = (adapter) => /widi\s*master/i.test(String(adapter || ''))
export function notAnsweringLine(unit, adapter = null) {
  const name = UNITS[unit] || 'unit'
  /* A footswitch picked as the adapter (notAnAdapter): what it is, and where to go instead. */
  if (notAnAdapter(adapter)) return `${adapterSaid(adapter)} is a MIDI footswitch, not an adapter for your ${name}. Pick the Bluetooth MIDI adapter plugged into the ${name} instead.`
  /* On every unit, the FM3 too since 15 November 2026: no adapter is ruled out for one any more, so its owner gets the WIDI Master's own two plugs like anybody. */
  if (isWidiMaster(adapter)) {
    return `WIDI Master connected, but the ${name} isn’t answering. ${masterBoth(unit)}${unit === 'axefx3' ? '' : ' And check that MIDI Thru is off.'}`
  }
  if (unit === 'axefx3') return `Adapter connected, but the ${name} isn’t answering. Check both MIDI plugs: the white one goes in MIDI OUT, not THRU.`
  return `Adapter connected, but the ${name} isn’t answering. Check both MIDI plugs, and that MIDI Thru is off.`
}

/*
 * A PRESET THAT DID NOT LAND BY PROGRAM CHANGE, on the FM9 and Axe-Fx III,
 * where that is the only way it goes (PC_FIRST). The settings that stop it
 * or move it, in Fractal's words for them: Program Change Off ignores it, a
 * different MIDI channel never hears it, PC Mapping sends it to the mapped
 * preset, and MIDI PC Offset "adds a specified value to all incoming MIDI
 * Program Change requests". `channel` is the one the phone sends on.
 */
export function presetMissLine(unit, channel = 1) {
  const name = UNITS[unit] || 'unit'
  return `On the ${name}, open Setup → MIDI/Remote and check that Program Change is On, the MIDI channel is ${channel} (or Omni), PC Mapping is Off, and MIDI PC Offset is 0.`
}

/*
 * THE FIRMWARE, from Fractal's own release notes. The FM9 answers the
 * status dump, which is how the phone lists a preset's effects, from 3.00
 * ("3rd Party MIDI Command "Status Dump" is now enabled"). And until FM9
 * 7.00 and Axe-Fx III 25.00, MIDI arriving at the MIDI In jack while the
 * unit started could stop its global settings loading ("Fixed global
 * settings not recalled if MIDI data is present on the MIDI In jack during
 * bootup"), which a phone still asking through a powered adapter would do.
 */
export function firmwareLineFor(unit) {
  if (unit === 'fm9') return 'Use FM9 firmware 7.00 or later. Older firmware may not list its effects, or may lose its settings if MIDI arrives while it starts.'
  if (unit === 'axefx3') return 'Use Axe-Fx III firmware 25.00 or later. Older firmware may lose its settings if MIDI arrives while it starts.'
  return null
}

/**
 * A unit's name said with its article: "an AM4", "an FM9", "an Axe-Fx III",
 * "a VP4". By how the name is said aloud: A, F and the other letters that
 * start with a vowel sound take "an".
 */
export const withArticle = (name) => `${/^[AEFHILMNORSX]/.test(String(name)) ? 'an' : 'a'} ${name}`

/**
 * WHICH UNIT REALLY ANSWERED, when it is not the one picked. Until 25 October
 * 2026 only an AM4 on another unit's connection was named, and every other
 * wrong pairing (an FM9 picked as an FM3, an FM3 on the AM4's) read
 * "isn't answering", which sends a player to the plugs. Now any unit the
 * wire knows (bleWire MODEL_NAMES) is named, with its article chosen here
 * from its bare name, and told the way out:
 *
 *   - a unit this account can pick: Stop, pick it in step 1, Connect (the
 *     VP4 among them since 25 October 2026: it said "The VP4 isn't a
 *     Bluetooth unit" until then);
 *   - any other (a copy that offers fewer units than the wire knows): the
 *     computer, after the line that says which units Bluetooth is for, when
 *     there is one.
 *
 * `answered` and `picked` are bare names as the page shows them; `pickable`
 * whether step 1 offers the one that answered; `forWhich` the line saying
 * which units it is for, or ''.
 */
export function wrongUnitLine({ answered, picked, pickable = false, forWhich = '' }) {
  const head = `${withArticle(answered).replace(/^a/, 'A')} answered, not the ${picked}.`
  if (pickable) return `${head} Tap Stop, pick ${answered} in step 1, then tap Connect.`
  return `${head} ${forWhich ? `${forWhich} ` : ''}Tap Stop, and use the computer for the ${answered}.`
}

/**
 * THE ADAPTER IS ON ANOTHER UNIT, said by the adapter's name, when the unit
 * that answered is one this account can pick: "The WIDI Jack is on an AM4,
 * not your FM3." (Justin's iPhone, 7 November 2026: the FM3 picked, the WIDI
 * Jack on his AM4, and the page said only that the FM3 was not answering.)
 * The page's button under it switches to that unit in one tap, on the same
 * connection (SWITCH_TO). `adapter` is the adapter's name as the phone lists
 * it ("WIDI Jack Bluetooth" on an iPhone is said "WIDI Jack"); with no name,
 * wrongUnitLine says it instead.
 */
export const adapterSaid = (name) => String(name || '').replace(/\s+bluetooth\s*$/i, '').trim()
export function wrongAdapterLine({ adapter, answered, picked }) {
  return `The ${adapterSaid(adapter)} is on ${withArticle(answered)}, not your ${picked}.`
}
export const SWITCH_TO = (answered) => `Switch to ${answered}`
export const SWITCH_TO_SUB = (adapter, answered) => `Uses the ${adapterSaid(adapter) || 'adapter'} for the ${answered}`

/*
 * CONNECT AGAIN: the adapter connected and the unit saying nothing, where
 * the cure on 7 November 2026 was Turn off Bluetooth and then Connect, a
 * fresh connection to the same adapter (bleLink connectBluetoothAgain). On
 * the Bluetooth page and in Play's Bluetooth note.
 */
export const CONNECT_AGAIN = 'Connect again'
export const CONNECT_AGAIN_SUB = 'A fresh connection to the adapter'

/*
 * BLUETOOTH OFF ON AN ANDROID PHONE OR TABLET: said, with Turn on Bluetooth
 * under it (Android's own question), and what happens next, so nobody taps
 * Connect again for nothing. `noun` is the device in hand (lib/device-word
 * deviceNoun). `kept`: an adapter is kept, which the link connects to by
 * itself whenever it next tries. Otherwise the page's search starts by
 * itself only while the app is waiting for Bluetooth (`waiting`); once that
 * wait has run out, the line says what to do instead.
 */
export const TURN_ON_BLUETOOTH = 'Turn on Bluetooth'
export const bluetoothOffLine = (noun) => `Bluetooth is off on this ${noun}`
export const bluetoothOffHint = (kept, waiting = true) =>
  kept ? 'Once it is on, the adapter connects by itself.' : waiting ? 'Once it is on, the search starts by itself.' : 'Turn it on, then tap Connect again.'

/*
 * AN ADAPTER THAT WILL NOT LEAVE APPLE'S LIST (iPhone or iPad): Forget in
 * Apple's Bluetooth MIDI screen did nothing for a WIDI Master still connected
 * to the iPhone (7 November 2026). The app cannot change Apple's screen, so
 * the way that works is said once, on Troubleshooting.
 */
export const appleListForget = (noun) =>
  `To take an adapter off Apple’s Bluetooth list, switch the adapter off first, or in the ${noun}’s Settings → Bluetooth, tap ⓘ beside it, then Forget This Device.`

/* Another unit's adapter in the page's list, and Troubleshooting's Forget for it: whose it is, by the unit's name. */
export const adapterOfUnit = (unit) => `the ${UNITS[unit] || 'other unit'}’s adapter`
