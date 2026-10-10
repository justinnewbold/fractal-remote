/**
 * BLUETOOTH (BETA): WHAT TO BUY, HOW IT PLUGS IN, AND WHERE THE FULL GUIDE IS.
 *
 * "We need to provide as much instructions as possible on how to connect it
 * and hook it up. So as far as I know, we need a CME Widi host. And then for
 * the AM4 I use these as well. Maybe we could add these with the Amazon
 * links on how to buy them? Cause I'm not sure what's needed for every single
 * device, but it is working with the AM4."
 *
 * ONE PLACE FOR EVERY ADDRESS. The phone's Bluetooth page reads this (its
 * generated copy, mobile/src/lib/bluetooth-gear.js), and so does the test
 * that holds the website's guide to it: public/bluetooth.html is plain HTML
 * and cannot import a module, so test/bluetooth.mjs reads every Amazon and
 * CME link on that page and fails on any that is not one of these. A link
 * changed here and not there, or there and not here, is a red run rather
 * than a guitarist buying the wrong thing.
 *
 * THE LINKS, as checked on amazon.com itself on 10 October 2026 (title,
 * seller and the page's own canonical address, read off the live page): the
 * plain /dp/<number> form, with no tracking on the end. No prices: they
 * change, and a price in the app is wrong the day it does.
 *
 * WHAT IS KNOWN TO WORK is one rig: his AM4, through the WIDI Uhost, the
 * C2MIDI Pro and the two 3.5 mm adapters, on an iPhone. The FM3, FM9 and
 * Axe-Fx III have the same 5-pin MIDI jacks the C2MIDI Pro was made for, so
 * the same chain without the adapters should work on them — but nobody has
 * tried it, and the page says so rather than promising it.
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
 * Pure data with no imports, so the phone's copy is a plain copy.
 */

/** The full guide on the website, for everything that does not fit on a phone screen. */
export const GUIDE_URL = 'https://fractal.newbold.cloud/bluetooth.html'

/** The units it has actually been tried on. Every other unit's steps say "not tried yet". */
export const TESTED = ['am4']

/**
 * WHAT TO SAY ABOUT IT BEING A BETA. "Let's just say that Bluetooth is beta
 * though in the app and give like a disclaimer saying that Bluetooth might
 * not function correctly." Short and calm, and with the way back: the cable
 * to the computer is untouched by any of this.
 *
 * FROM AN IPHONE, AND NOT YET FROM AN ANDROID PHONE. Every hardware test so
 * far was an iPhone: the one Android build that carried this (8 October)
 * stopped on Expo's side a minute in, so no Android phone has ever run it.
 * And this is the text Android customers read, on the Play copy that goes to
 * all of them. "Tried on the AM4" alone would tell them it works on their
 * phone; the website's guide and What's New already say "from an iPhone", so
 * the app says it too. Change it the day an Android phone has driven a unit.
 */
export const BETA_NOTE =
  'Bluetooth is new (beta), and may not work correctly with every unit or adapter. So far it has been tried on the AM4, from an iPhone, and not yet from an Android phone. If something doesn’t work, the cable to the computer still does.'

/** The same, short enough for the card on Phone & computer that leads to the page. */
export const BETA_CARD =
  'Play without a computer, through a Bluetooth MIDI adapter on the unit. New (beta): so far tried on the AM4 from an iPhone, and it may not work with every unit, adapter or phone.'

/** The parts, by the name printed on the box, each with what it is for in a line. */
export const PARTS = {
  uhost: {
    name: 'CME WIDI Uhost',
    does: 'The Bluetooth adapter. Your phone connects to it.',
    amazon: 'https://www.amazon.com/dp/B09GS326QW',
    maker: 'https://www.cme-pro.com/widi-uhost/'
  },
  c2midi: {
    name: 'CME C2MIDI Pro',
    does: 'The cable from the Uhost to the unit’s MIDI jacks: one USB-C plug, a black MIDI plug and a white one.',
    amazon: 'https://www.amazon.com/dp/B0GVXTX5D1',
    maker: 'https://www.cme-pro.com/c2midi-pro/'
  },
  adapters: {
    name: 'Two Type-A MIDI to 3.5 mm adapters',
    does: 'AM4 only: its MIDI jacks are small 3.5 mm ones. They must be Type A. This is a pack of two (LOOTOOLS).',
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

const UNITS = { am4: 'AM4', fm3: 'FM3', fm9: 'FM9', axefx3: 'Axe-Fx III' }

/** What to buy for one unit, in the order it plugs together. */
export function partsFor(unit) {
  const keys = unit === 'am4' ? ['uhost', 'c2midi', 'adapters'] : ['uhost', 'c2midi']
  return keys.map((key) => ({ key, ...PARTS[key] }))
}

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
  'With the C2MIDI Pro, the black plug goes in the unit’s MIDI IN and the white one in MIDI OUT. Swapped, nothing gets through.'

/** Before a unit is picked: the whole of it in two lines. */
export const GEAR_IN_SHORT =
  'A CME WIDI Uhost, a CME C2MIDI Pro, and a phone charger or power bank with a USB-C cable for the Uhost. For an AM4, also two Type-A MIDI to 3.5 mm adapters. Pick your unit above for where to buy them and how they plug in.'

/**
 * How it plugs together, for one unit, in at most five short steps.
 *
 * The MIDI side first and the power last, so the unit is already on and
 * started when the Uhost wakes up. Null for a unit this does not know.
 */
export function hookupFor(unit) {
  const name = UNITS[unit]
  if (!name) return null
  const usb = 'Plug the C2MIDI Pro’s USB-C plug into the Uhost’s left socket, marked USB Host/Device.'
  const power = `With the ${name} already on, plug a phone charger or power bank into the Uhost’s right socket, marked USB Power (5 volts, nothing stronger). The Uhost needs this power to work.`
  if (unit === 'am4') {
    return [
      'Push one 3.5 mm adapter into the AM4’s MIDI IN, and the other into its MIDI OUT.',
      'C2MIDI Pro: the black plug (TO MIDI IN) into the adapter in MIDI IN, and the white plug (TO MIDI OUT) into the adapter in MIDI OUT.',
      usb,
      power,
      'On the AM4, open Setup → MIDI/Remote and set MIDI Thru to Off.'
    ]
  }
  if (unit === 'axefx3') {
    return [
      'C2MIDI Pro: the black plug (TO MIDI IN) into the Axe-Fx III’s MIDI IN.',
      'The white plug (TO MIDI OUT) into its MIDI OUT. Not THRU: the phone would only hear itself there.',
      usb,
      power
    ]
  }
  return [
    `C2MIDI Pro: the black plug (TO MIDI IN) into the ${name}’s MIDI IN.`,
    `The white plug (TO MIDI OUT) into its MIDI OUT/THRU jack.`,
    usb,
    power,
    `On the ${name}, open Setup → MIDI/Remote and set MIDI Thru to Off.`
  ]
}

/** Said under the steps for a unit nobody has tried it on yet. */
export const untriedLine = (unit) =>
  triedOn(unit) || !UNITS[unit] ? null : `Not tried on the ${UNITS[unit]} yet. It should work the same way.`
