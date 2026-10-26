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
 * the C2MIDI Pro and the WIDI Master are never for an FM3 (NOT_FOR_FM3).
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
 * screen. At bluetooth-guide.html, linked from nowhere on the website until
 * the store version that opens Bluetooth (beta) to customers is live:
 * /bluetooth says it is not in the app yet, with nothing to buy. Only the
 * app's Bluetooth page links here, which only his account can open on every
 * copy there is today (lib/ble-rule.js: a customer's only on a store copy
 * built to open it).
 */
export const GUIDE_URL = 'https://fractal.newbold.cloud/bluetooth-guide.html'

/** The units it has actually been tried on. Every other unit's steps say "not tried yet". */
export const TESTED = ['am4', 'fm3']

/**
 * WHAT TO SAY ABOUT IT BEING A BETA. "Let's just say that Bluetooth is beta
 * though in the app and give like a disclaimer saying that Bluetooth might
 * not function correctly." Short and calm, and with the way back: the cable
 * to the computer is untouched by any of this.
 *
 * IN HIS WORDS, SINCE 25 OCTOBER 2026. Bluetooth (beta) is to reach every
 * customer with the full version, marked beta with "Bluetooth is in beta, and
 * some features might not work as expected", and "super easy for all users to
 * submit bugs and feedback". So the note opens with his sentence word for
 * word, says where it has been tried, sends a player who meets a problem to
 * the button straight under the note (REPORT_BUTTON, which sends one in a
 * tap), and ends on the way back: the cable to the computer still does
 * everything. It said "Bluetooth is new (beta), and may not work correctly
 * with every unit or adapter" until then.
 *
 * FROM AN IPHONE, AND FROM AN ANDROID PHONE. Until 25 October 2026 every
 * hardware test was an iPhone (the one Android build that carried this, on 8
 * October, stopped on Expo's side a minute in), and Android's note said "not
 * yet from an Android phone". Then: "I have tried it from an android phone
 * and it works great." So Android's note says both, and it is still only
 * the AM4: every other unit is said as not tried yet, on its own lines.
 *
 * TWO COPIES, ONE PER PHONE. The Android clause is for Android only. Apple's
 * guideline 2.3.10: "don't include names, icons, or imagery of other mobile
 * platforms or alternative app marketplaces in your app or metadata", and
 * "Your app includes references to Android" is one of the commonest
 * rejections there is. This note is on the Bluetooth page, always drawn and
 * never folded, under Connect and the rows that open (since 24 October
 * 2026; before, it was the first thing on it), and the version that opens
 * Bluetooth to customers will have review notes
 * that send Apple's reviewer to exactly that page. (The 1.87.1 notes that
 * would have done it never reached Apple: build 26 stayed on TestFlight, and
 * the 1.87.11 notes Apple approved say only the developer's account sees
 * it.) So the
 * iPhone says where it has been tried and stops; Android says the same and
 * that it has not been tried on a phone like theirs.
 *
 * Picked by betaNote(Platform.OS) on the page. This file imports nothing, so
 * the platform is passed in, and anything that is not Android gets the
 * iPhone's copy: a phone this has never heard of never shows Android's name.
 */
/*
 * THE BUTTON THE NOTE POINTS AT, named once, so the note and the button can
 * never call it two different things. On the Bluetooth page under the note,
 * and wherever else a Bluetooth problem is met (the note under Play's pill,
 * a fault on Play while over Bluetooth, the waiting screen), it opens the
 * one-tap report (mobile/src/screens/BluetoothReport.js), which goes to
 * Justin and nobody else: help with the app is his own channels only.
 */
export const REPORT_BUTTON = 'Report a Bluetooth problem'
/*
 * OUT OF BETA, 26 OCTOBER 2026: "I also think we're ready to get the
 * Bluetooth out of beta so remove anything that says beta on it for
 * Bluetooth." So the note no longer opens "Bluetooth is in beta"; it keeps
 * what is useful in it: where it has been tried, the button for a problem,
 * and the way back. (The names BETA_NOTE_* and betaNote are kept, not the
 * word.)
 */
const BETA_ENDS = `If something doesn’t work, tap ${REPORT_BUTTON}, just below. The cable to the computer still does everything.`
export const BETA_NOTE_IPHONE = `So far, Bluetooth has been tried on the AM4 and the FM3, from an iPhone. ${BETA_ENDS}`
export const BETA_NOTE_ANDROID = `So far, Bluetooth has been tried on the AM4 and the FM3, from an iPhone and an Android phone. ${BETA_ENDS}`

/** The beta note for the phone it is shown on, from Platform.OS. */
export const betaNote = (os) => (os === 'android' ? BETA_NOTE_ANDROID : BETA_NOTE_IPHONE)

/*
 * TWO WAYS TO CONNECT, AND WHICH IS BEST. "Make it clear that there's
 * multiple ways to connect the device, but also make it clear that the
 * computer is the preferred method and that Bluetooth will have more lag and
 * not have as many features." (Justin, 25 October 2026.) Said wherever
 * Bluetooth is offered, in words a guitarist reads in two seconds: the
 * Bluetooth page above Connect, the Settings row, the waiting screen's way
 * in, the Phone & computer page while it is on, and the purchase page.
 *
 * ONLY WHAT IS TRUE OF IT. More lag: the preset list is read a name at a
 * time over a 5-pin MIDI cable (bleWire NAME_GAP_MS), an AM4's scene names
 * take seconds the first time a preset is seen, and a footswitch change shows
 * at the next poll, up to two seconds later (POLL_MS). Fewer features: no
 * editing or saving, no looper, volume button, unit metronome click or
 * Footswitches page (the page's DIFFERENT list). Everything the app does, it
 * does through the computer.
 *
 * "MORE LAG" IS HIS WORD, AND KEPT. For a day this said "slower", because how
 * long one tap takes each way has never been timed. But he has played it, and
 * what the code shows is lag too: a footswitch change reaches the screen up
 * to two seconds after it is pressed, and names arrive a few at a time. And
 * "slower" reads as the preset list taking its time, not as a delay on what
 * he plays, which is the thing he asked to have said.
 *
 * NOT "AND DOES EVERYTHING". It said that for a day, and on the purchase
 * page it came straight after VP4_SO_FAR, the list of what a VP4 cannot do
 * from the app yet: two sentences that disagree, where somebody pays. The
 * computer is the best way; what Bluetooth lacks is said after it.
 *
 * One sentence, its one-line form for a button's second line, and the Settings row's
 * own, which has one short line to say both halves in: written together here
 * so they can never say different things.
 */
export const BLUETOOTH_WAYS =
  'There are two ways to connect. The computer is the best one. Bluetooth needs no computer, but it has more lag and fewer features.'
export const BLUETOOTH_WAYS_SHORT = 'More lag than the computer, fewer features'
/*
 * THE SETTINGS ROW, OFF: what it is for and what it costs, in the one line a
 * row has (Settings.js SetupRow, cut at one line on a 320-point screen). It
 * said only the cost for a day, "slower than the computer, fewer features",
 * which read as a row that had nothing going for it, in the row's green.
 */
export const BLUETOOTH_ROW_OFF = 'Off · no computer needed, more lag'

/*
 * NEVER THE C2MIDI PRO ON AN FM3, TO EVERYBODY, BEFORE AND WHATEVER IS
 * PICKED. FM3_NEVER is drawn once the FM3 is picked; an FM3 owner who has
 * not picked yet would otherwise read an AM4's shopping list first. So this
 * goes under the units in step 1, on every visit. It said "Not for an FM3"
 * while the FM3 was not offered to customers; it is offered now, and what
 * is not for an FM3 is the cable.
 */
export const NOT_FOR_FM3 = 'On an FM3, use the CME U2MIDI Pro, never the C2MIDI Pro or a WIDI Master: both got very hot on one.'

/*
 * The purchase page's line, on a copy that opens Bluetooth to customers: the
 * two ways, which units and which have been tried, then what it needs. Every
 * part, by the name on its box (PARTS, below) and what it is, plus
 * POWER_LINE's charger, with no prices: the one screen where somebody pays
 * on what it says, and the list is four parts and a charger, not "an
 * adapter". It said one adapter for a day, and the AM4 alone until 25
 * October 2026. And what a VP4 gets over it (presets and scenes), and that
 * the cable is never for an FM3, on the screen where an owner of either
 * decides whether to pay.
 *
 * NAMED HERE, NOT SENT ELSEWHERE. It said "(the Bluetooth page lists them)"
 * for a day, but nobody who has not paid can open that page: the Settings
 * row, the waiting screen's button and the Fixes line all wait for the
 * purchase. So the names are in the line itself, where somebody deciding
 * whether to pay can read them, and look them up.
 */
export const BLUETOOTH_PAYWALL = `${BLUETOOTH_WAYS} It is offered on the AM4, FM3, FM9, Axe-Fx III and VP4, and so far has been tried on the AM4 and FM3; on a VP4 it changes presets and scenes only. It needs parts sold separately: a CME WIDI Uhost (the Bluetooth adapter) and a CME C2MIDI Pro (its MIDI cable), or a CME U2MIDI Pro in its place for an FM3, plus two Type-A MIDI to 3.5 mm adapters for an AM4 or VP4, and a USB charger or power bank. Never the C2MIDI Pro on an FM3: it got very hot on one.`


/** The parts, by the name printed on the box, each with what it is for in a line. */
export const PARTS = {
  uhost: {
    name: 'CME WIDI Uhost',
    /* What the player's phone, iPad or tablet connects to: partsFor fills the noun in. */
    does: (noun = 'phone') => `The Bluetooth adapter. Your ${noun} connects to it.`,
    amazon: 'https://www.amazon.com/dp/B09GS326QW',
    maker: 'https://www.cme-pro.com/widi-uhost/'
  },
  c2midi: {
    name: 'CME C2MIDI Pro',
    does: 'The cable from the Uhost to the unit’s MIDI jacks: one USB-C plug, a black MIDI plug and a white one.',
    amazon: 'https://www.amazon.com/dp/B0GVXTX5D1',
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
    amazon: null,
    maker: 'https://www.cme-pro.com/u2midi-pro-usb-to-midi-cable/'
  },
  adapters: {
    name: 'Two Type-A MIDI to 3.5 mm adapters',
    does: 'For an AM4 or VP4: their MIDI jacks are small 3.5 mm ones. They must be Type A. This is a pack of two (LOOTOOLS).',
    amazon: 'https://www.amazon.com/dp/B0FN83P5P7',
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
 * THE FM3 WARNING, in place of its parts and its steps, for the account that
 * can still pick it: what happened, and what owners report, in the fewest
 * words that say both. Said as their reports, not as a fact about the
 * FM3's hardware, and with no home-made way round it (see the head of this
 * file).
 */
export const FM3_WARNING =
  'On an FM3, use the CME U2MIDI Pro. When we tried the WIDI Master and the C2MIDI Pro on an FM3, both got very hot, and the WIDI Master did not work. The U2MIDI Pro runs on USB power only: on an FM3 it works and stays cool. FM3 owners report the same heat with other adapters that take power from its MIDI OUT, even on USB power.'

/** The units the parts list must not be bought for as it is: none since the FM3 has the U2MIDI Pro (26 October 2026). */
export const NOT_STRAIGHT_IN = []

/*
 * THE FM3 LINE THAT IS NEVER FOLDED AWAY. FM3_WARNING is inside How to plug
 * it in, which starts folded for anybody who has used an adapter here
 * before, and NOT_FOR_FM3 is under step 1, which is not drawn while
 * Bluetooth is on. The likeliest cable to end up on an FM3 is an AM4
 * owner's C2MIDI Pro. So whenever the FM3 is the unit picked, on or off,
 * this is drawn near the top of the page, where nothing folds it (critic,
 * 25 October 2026). Said as the guide and docs/bluetooth-midi.md say it:
 * what happened here, and what owners report, never a fact about the unit.
 *
 * WITH "EVEN ON USB POWER", as FM3_WARNING and the guide have it ("Powering
 * the adapter from USB doesn't stop it, because the jack is still feeding
 * it"). This is the only FM3 line drawn with the fold closed, and without it
 * the owner of a WIDI Jack or WIDI Master on a USB charger read it as not
 * about their adapter. "Can take" power, so an adapter that runs on USB
 * power alone, and never from the jack (the U2MIDI Pro the FM3 plan tries),
 * is not in it.
 */
export const FM3_NEVER =
  'On an FM3, use the CME U2MIDI Pro: it runs on USB power only, and when we tried it, it worked and stayed cool. Never the WIDI Master or the C2MIDI Pro: on an FM3 both got very hot, and the WIDI Master didn’t work. Nor any adapter that can take power from MIDI OUT, even on USB power: FM3 owners report the same.'

/*
 * THE WIDI MASTER ON AN AM4: tried and working (26 October 2026), in place
 * of the Uhost and the C2MIDI Pro, its two MIDI plugs in the two 3.5 mm
 * adapters. Said under the AM4's parts, with no link (nobody has checked
 * one against the live page), and never for an FM3.
 */
export const ALSO_ON_AM4 =
  'On an AM4, a CME WIDI Master works too, in place of the Uhost and the C2MIDI Pro: its two MIDI plugs go into the two 3.5 mm adapters. Never on an FM3.'

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
 */
export const CLOSE_AND_REOPEN =
  'Still not connecting after unplugging and plugging the adapter back in? Close the app completely (swipe it away) and open it again.'

/*
 * FEEL THE CABLE, ON THE UNITS NOBODY HERE HAS. The FM9 and Axe-Fx III have
 * the 5-pin jacks the C2MIDI Pro was made for, and owners report CME's
 * adapters running cool on them; but the cable that ran hot on the FM3 is
 * the same one, and nobody has tried it with the app on either. The guide
 * has said it since it listed them ("Feel the cable in the first minute: it
 * should stay cool"); the app said nothing, and an FM9 or Axe-Fx III
 * owner's first physical risk is this. Said straight after the power step
 * (powerStepOf), as the guide says it after the power and the lights, and
 * before any step that sends the player into the unit's menus: a minute
 * goes in those.
 */
export const HEAT_CHECK =
  'In the first minute, feel the C2MIDI Pro. It should stay cool. If it gets more than slightly warm, unplug it at once.'

/** The heat line for a unit's steps, or null: the FM9, Axe-Fx III and VP4, the units it is offered on untried with these parts (the FM3 has FM3_NEVER instead). */
export const heatLineFor = (unit) => (unit === 'fm9' || unit === 'axefx3' || unit === 'vp4' ? HEAT_CHECK : null)

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
export const SELLERS_LINE = 'CME and LOOTOOLS make these parts. Fractal Remote has nothing to do with them or with Amazon, and gets nothing from these links.'

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
 * it: NOT_FOR_FM3 says it to everybody under step 1, right above, whatever
 * is picked. One list for everybody since 25 October 2026, when a customer
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

/** Where the power goes in among a unit's steps (hookupFor), counting from 0: the heat line is drawn straight after it. -1 for a unit with no steps. */
export const powerStepOf = (unit) => (hookupFor(unit) || []).indexOf(powerStep(UNITS[unit]))

/*
 * Said under the steps for a unit nobody has tried it on yet. The FM3 has its
 * warning instead. It said "It should work the same way.", which is a promise
 * about a unit nobody has run, and Apple's 2.3.1(a) keeps an app from
 * claiming what it has not shown. Now it asks to hear how it went, through
 * the app's own report: help with the app is Justin's channels only.
 *
 * THE BUTTON ON THIS PAGE, NOT A PATH THROUGH SETTINGS. It said "Settings →
 * Troubleshooting → Feedback" until 25 October 2026, three screens away from
 * the page it is read on, and a typed form at the end of them. The page has
 * REPORT_BUTTON further down, under the beta note, which sends in one tap,
 * "It works on my unit" among its answers.
 */
export const untriedLine = (unit) =>
  !untried(unit) ? null : `Not tried on the ${UNITS[unit]} yet. If you try it, tell us how it went: tap ${REPORT_BUTTON}, further down this page.`

/*
 * "NOT TRIED YET", WHEREVER AN FM9 OR AXE-FX III OWNER LOOKS. "On any units
 * that haven't been tried we still want to build everything out from what
 * we know, but yes, we can say this hasn't been tried on a real device yet
 * ... just mention that they haven't been tried and to report problems if
 * they find them." (Justin, 25 October 2026.) untriedLine says it inside How
 * to plug it in, which folds closed once an adapter has been used; these say
 * it everywhere else an owner of one of them is: on its button in step 1,
 * under "Connected", in What it can and can't do, under the Bluetooth pill
 * on Play, on a fault card on Play, and in the head of a report's log. The
 * units are the ones with steps, no warning, and no try on record: the FM9
 * and the Axe-Fx III (the FM3 has its heat warning in place of steps). Each
 * line that sends the player somewhere sends them to REPORT_BUTTON, in its
 * own words. Never "official", never "this phone": the device in hand is
 * not named in any of them.
 *
 * THE VP4 AND THE FM3 TOO, since 25 October 2026, when every unit opened to
 * customers in one store version. The VP4 like the FM9: nobody here has
 * one. The FM3 in words of its own: it has been tried, once, and that cable
 * got very hot and never connected, so "not tried" would be untrue beside
 * FM3_NEVER's "when we tried it". It "hasn't run" on one, which is what is
 * true, and its warning stays where it was, in front.
 *
 * THE FM3 TRIED, 26 OCTOBER 2026: it ran, through the Uhost and a U2MIDI
 * Pro, from an iPhone and an Android phone (TESTED). So it says none of
 * these, and its own "hasn't run" words went with it; its warning stays in
 * front, now naming the cable that works.
 */
export const untried = (unit) => !!UNITS[unit] && !triedOn(unit)

/* "Not tried on the FM9 yet". */
const notYetOn = (unit) => `Not tried on the ${UNITS[unit]} yet.`

/** Under a unit's name on its button in step 1. */
export const UNTRIED_SUB = 'Not tried yet'
export const untriedSubFor = (unit) => (!untried(unit) ? undefined : UNTRIED_SUB)

/** Under "Connected · FM9 answering". */
export const untriedConnectedLine = (unit) =>
  untried(unit) ? `${notYetOn(unit)} Tell us how it goes: tap ${REPORT_BUTTON}, below.` : null

/** The first line of What it can and can't do. */
export const untriedAboutLine = (unit) =>
  !untried(unit)
    ? null
    : `Built from what is known about the ${UNITS[unit]}, but not yet tried on a real one. Some of it may not work as expected.`

/** Added to the note under the Bluetooth pill on Play (it starts "Connected over Bluetooth, through …"). */
export const untriedShortLine = (unit) => (untried(unit) ? notYetOn(unit) : null)

/** The small line on a fault card's Report this, on Play. */
export const faultSubFor = (unit) =>
  !untried(unit) ? 'Bluetooth' : `Bluetooth, not tried on the ${UNITS[unit]} yet`

/** The unit's name as a report's log head says it: "FM9 (not tried yet)", "AM4". */
export const unitForReport = (unit) => (UNITS[unit] ? `${UNITS[unit]}${!untried(unit) ? '' : ' (not tried yet)'}` : null)

/*
 * WHAT A VP4 GETS OVER BLUETOOTH, wherever it is the unit picked: What it can
 * and can't do on the Bluetooth page, in place of the line for the other
 * units, and on Play in place of the chain the phone cannot read (Stage, a
 * VP4 over Bluetooth). Presets and scenes, by the two messages a foot
 * controller sends, and nothing read back (lib/bleVp4.js): no effects, no
 * names, no tuner, and nothing to say a preset or scene landed. The way to
 * the rest is the computer, as it is for every unit.
 */
export const VP4_OVER_BLUETOOTH =
  'Over Bluetooth, the app changes a VP4’s presets and scenes, the way a MIDI foot controller does, and nothing else. It can’t hear the VP4 that way, so it can’t show its effects, names or tuner, or check that a preset or scene landed. For those, use the computer.'

/* And under "Connected" on the page: the adapter is all a VP4's link can know. */
export const VP4_CONNECTED = 'Connected · sending to the VP4'
export const VP4_CANT_HEAR =
  'The app can’t hear a VP4 over Bluetooth, so this only says the adapter is connected. If presets don’t change, check the black plug is in the VP4’s MIDI IN, and on the VP4 that SETUP > MIDI/Remote has Receive MIDI PC ON.'

/*
 * THE BLOCKS PLAY DOES NOT DRAW YET, on the units that have them. Fractal's
 * Blocks Guide (June 2023) gives the FM9 and Axe-Fx III blocks the FM3 has
 * none of: Crossover, Vocoder and Tone Match on both, and IR Player and
 * Dynamic Distortion on the III alone. None has a family on Play (no color,
 * no picture, no place in the signal order), and the computer app does not
 * draw them either, so they come together on both paths in one later change.
 * Until then the page says so, rather than leave an owner looking for a
 * block that is in the preset.
 */
export function missingBlocksLine(unit) {
  if (unit === 'fm9') return 'A few blocks the FM3 doesn’t have (Crossover, Vocoder, Tone Match) aren’t shown on Play yet.'
  if (unit === 'axefx3') return 'A few blocks the FM3 doesn’t have (Crossover, Vocoder, Tone Match, IR Player, Dynamic Distortion) aren’t shown on Play yet.'
  return null
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
 */
export function notAnsweringLine(unit) {
  const name = UNITS[unit] || 'unit'
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
