/**
 * Where the phone app lives.
 *
 * "Maybe even QR codes that they can scan to go directly to the App Store or
 * the Google Play store to download it, which I know we don't have those yet."
 *
 * The ADDRESSES exist already and always did — an App Store URL is the
 * numeric id from App Store Connect, a Play URL is the package name, and both
 * were fixed the day those records were created. What did not exist was
 * anything behind them: both answered 404 until each app was actually
 * published (Google Play on 4 October 2026, the App Store on 8 October), and
 * a QR code leading to a 404 is worse than no QR code, because somebody has
 * to fetch their phone and aim it to find that out.
 *
 * So the address and the AVAILABILITY are two different facts and are stored
 * as two. `live` is the only thing that changes on the day each store opens,
 * and nothing else in the app needs touching — the page reads these, draws a
 * square for what is live and says "coming soon" for what is not.
 *
 * WHY THIS IS NOT DETECTED AT RUNTIME. A browser cannot ask apps.apple.com
 * whether a listing exists: the request is blocked before it is answered, and
 * the app would have to guess from a failure it cannot see. A flag somebody
 * sets on the day they press Publish is one honest line; a guess is a page
 * that changes its mind on a bad network.
 */

/** The App Store Connect record. */
export const APPLE = {
  id: '6812916461',
  url: 'https://apps.apple.com/app/id6812916461',
  /* Live on the App Store since 8 October 2026: Apple approved build 24
     (1.86.83), and the listing came up a few hours after release. */
  live: true
}

/** The Play Console record, keyed by the package name the app is built with. */
export const GOOGLE = {
  id: 'cloud.newbold.fractalremote',
  url: 'https://play.google.com/store/apps/details?id=cloud.newbold.fractalremote',
  /* Live in production on Google Play since 4 October 2026. */
  live: true
}

/**
 * The two, in the order they are offered.
 *
 * Apple first because that is the one this app was built for first, and
 * because a list that reorders itself by what happens to be live reads as a
 * bug to anybody who saw it the other way round yesterday.
 */
export const STORES = [
  { key: 'ios', name: 'iPhone & iPad', store: 'App Store', ...APPLE },
  { key: 'android', name: 'Android', store: 'Google Play', ...GOOGLE }
]

/** Whether there is anything at all to point anybody at yet. */
export const anyStoreLive = () => STORES.some((s) => s.live)

/**
 * BLUETOOTH IS IN THE APPS, NOT IN A WEB BROWSER.
 *
 * "We need to have options on there to say, do you wanna connect with
 * Bluetooth? That is available only in the apps, not on the website version.
 * Only a computer can connect on the web version. But it was confusing for me
 * cause I kept trying to find Bluetooth." (Justin, 7 November 2026, of the
 * website on an iPhone.) A browser cannot reach a Bluetooth MIDI adapter, so
 * the website never offers one: it says, in one line, where Bluetooth is,
 * with the two stores beside it (src/components/BluetoothInApps.jsx), wherever
 * it explains connecting. Bluetooth first, as everywhere since that day.
 * Never in the computer app's own window, which is the computer. The iPad by
 * name: the App Store app is the iPhone and iPad app (STORES), Bluetooth
 * works on an iPad, and an iPad owner read "the iPhone and Android apps" as
 * not theirs.
 */
export const BLUETOOTH_IN_APPS = 'Bluetooth, with no computer, is in the iPhone, iPad and Android apps. A web browser connects through a computer only.'

/*
 * HOW IT WORKS, IN A WEB BROWSER: BLUETOOTH FIRST, AS ON THE PHONE. "The
 * initial walkthrough on the website is the one that's not showing the
 * Bluetooth stuff at first" (Justin, 8 November 2026, of the website on an
 * iPhone, which opened on the computer's three boxes with the line about
 * the apps above them). So the website's How it works has the phone's two
 * choices, Bluetooth first and picked (HOW_TWO_WAYS in shared/bluetooth-gear.mjs,
 * whose labels, cable and foot these are, word for word: test/both-ends.mjs
 * holds them together), and its Bluetooth way is the phone's two boxes. Its
 * second box is the app, not this browser, which can never reach an adapter:
 * BLUETOOTH_IN_APPS under it says where the app is, with the stores. Here and
 * not imported from bluetooth-gear, which the browser does not carry.
 */
export const BROWSER_HOW_BLUETOOTH = {
  ways: [
    { key: 'bluetooth', label: 'Bluetooth' },
    { key: 'computer', label: 'Computer' }
  ],
  wire: 'BLUETOOTH MIDI ADAPTER',
  appTitle: 'YOUR PHONE OR TABLET',
  appBody: 'In the Fractal Remote app - no computer needed',
  foot: 'The adapter plugs into the unit’s MIDI jacks and is sold separately.'
}

/*
 * THE BOX TICKED BEFORE UNLOCK, IN A WEB BROWSER. It said his sentence of
 * the first walkthrough, "I understand this app requires a computer
 * connected to my Fractal unit via USB cable for the Fractal Remote app to
 * work", which stopped being true of what is bought when Bluetooth opened:
 * the purchase is the account's, and the iPhone, iPad and Android apps reach
 * the unit with no computer. "This is on the website. Have you addressed
 * this yet and added the Bluetooth stuff?" (Justin, 7 November 2026, of
 * this box.) So Bluetooth first, where it is, and that a web browser needs
 * the computer, as BLUETOOTH_IN_APPS says it. The computer app's own window
 * keeps his sentence (it is the computer), and so do the phone's copies that
 * do not open Bluetooth (WALKTHROUGH_TWO_WAYS.agree where they do).
 */
export const AGREE_IN_BROWSER =
  'I understand Bluetooth, through a MIDI adapter sold separately, is in the iPhone, iPad and Android apps, and a web browser connects through a computer by USB cable.'
