/*
 * CONNECT YOUR UNIT: ONE ROW, PICK THE WAY, GET ITS STEPS.
 *
 * "Where are the raspberry pie set up instructions and the computer set up
 * instructions in the app? I couldn't find them anywhere ... we need to do a
 * lot of work on the settings menu, troubleshooting, set up of devices ... to
 * make it simpler and easier to read and easier for a user to select which
 * device they're setting up and get the proper instructions for it."
 * (Justin, 10 November 2026.)
 *
 * The Raspberry Pi's steps were on the website only, and the computer's were
 * a TipCard deep in Phone & computer. So Settings → My rig opens on one row,
 * Connect your unit, and its page is four choices, Bluetooth first (CLAUDE.md,
 * "Bluetooth first, and short"), each opening its own short steps:
 *
 *   Bluetooth adapter  the Bluetooth page
 *   USB cable          the Bluetooth page too, which offers a plugged-in
 *                      cable by name (Use the USB cable)
 *   A computer         Connect a computer's three steps
 *   Raspberry Pi       its own page here: four steps, the full guide one tap
 *                      away, and the three things that most often go wrong
 *
 * The adapter and the cable are drawn only where this copy offers Bluetooth,
 * the same gate as the Bluetooth row. The Bluetooth row and Phone & computer
 * stay under it: the store texts, the website's guides and the setup email
 * name "Settings → My rig → Bluetooth", and they stay true.
 *
 * Words only. The Pi page links to the website's guide for what to buy,
 * never straight to Amazon, so the Associates sentence stays where the links
 * are (the guide's foot). Raspberry Pi is a trademark of Raspberry Pi Ltd, and
 * its logo is never drawn: the card wears a plain board (icons/board.png).
 *
 * Nothing here imports anything, so a test runs it as it is.
 */

/** The row's title in Settings → My rig, and the page's. */
export const CONNECT_ROW = 'Connect your unit'

/** Over the four choices. */
export const CONNECT_ASK = 'How will you connect?'

/** The four ways, Bluetooth first. `noun` is the device in hand (deviceNoun()). */
export const connectWays = (noun) => [
  { key: 'adapter', title: 'Bluetooth adapter', sub: 'No computer needed' },
  { key: 'cable', title: 'USB cable', sub: `Your unit plugged straight into this ${noun}` },
  { key: 'computer', title: 'A computer', sub: 'Mac, Windows or Linux, with the free app' },
  { key: 'pi', title: 'Raspberry Pi', sub: 'A small computer that stays with your unit' }
]

/**
 * The row's one line: how it is connected now, or that it is not yet.
 * `bluetooth` and `cable` are the phone's own way on; `link` the computer's
 * link ('connected' when a computer answers); `macName` its name; `offered`
 * whether this copy offers Bluetooth, so the ways named are the ways drawn.
 */
export function connectRowStatus({ bluetooth = false, cable = false, link = null, macName = null, offered = false } = {}) {
  if (cable) return 'USB cable'
  if (bluetooth) return 'Bluetooth'
  if (link === 'connected') return macName ? `Computer · ${macName}` : 'Computer'
  return offered ? 'Bluetooth, USB cable, computer or Pi' : 'A computer or a Raspberry Pi'
}

/* ------------------------------------------------------------ Raspberry Pi */

export const PI_TITLE = 'Raspberry Pi'

/** The website's guide, every step with pictures of where to click. */
export const PI_GUIDE_URL = 'https://fractal.newbold.cloud/raspberry-pi'
/** Its What to buy, with the links (and the Associates sentence at its foot). */
export const PI_BUY_URL = `${PI_GUIDE_URL}#buy`

export const PI_GUIDE = 'Full step-by-step guide'
export const PI_BUY = 'See what to buy'

/** Under the title: what a Pi is for, in one line. */
export const piLead = (noun) => `A small computer that sits by your unit, so this ${noun} controls it with no laptop.`

/** Four steps, a line each. The guide has the rest. */
export const piSteps = (noun) => [
  { title: 'Get a Pi', body: 'A Raspberry Pi 5 kit with a case, power supply and memory card is easiest.' },
  { title: 'Put Raspberry Pi OS on its card', body: 'From your computer, with the free Raspberry Pi Imager. About 20 minutes.' },
  {
    title: 'Put Fractal Remote on the Pi',
    body: `Download it on the Pi from fractal.newbold.cloud/downloads, sign in with the same account as this ${noun}, then tick Start when this computer turns on (Settings → About).`
  },
  { title: 'Plug your unit into the Pi', body: `With its USB cable. This ${noun} finds it.` }
]

export const PI_TROUBLE_TITLE = 'Not working?'

/** The three that go wrong most, from the guide's own list, a line each. */
export const piTrouble = (noun) => [
  {
    problem: 'The Pi doesn’t show up',
    fix: 'Give it ten minutes. Still not there? The wifi name or password was probably typed wrong: write the card again.'
  },
  {
    problem: `This ${noun} says there’s no computer`,
    fix: `Sign in to the same account on the Pi and this ${noun}, check Start when this computer turns on is ticked, and give the Pi a few minutes after switching it on.`
  },
  { problem: 'It can’t find my unit', fix: 'Use a USB data cable, not a charge-only one, and switch the unit off and on.' }
]

/** At the page's foot, as the guide says it. */
export const PI_TRADEMARK = 'Raspberry Pi is a trademark of Raspberry Pi Ltd. Fractal Remote is not connected with Raspberry Pi Ltd.'

/* --------------------------------------------------------- troubleshooting */

/*
 * TROUBLESHOOTING, BY HOW YOU'RE CONNECTED. The same four ways, in the same
 * order, each opening only the fixes for that way: the Bluetooth adapter's
 * and the USB cable's (the Bluetooth page's own troubleshooting, told which),
 * the computer's (Fixes), and the Pi's. The way in use now says so. The log
 * and Feedback come after, under Still stuck?.
 */
export const TROUBLE_ASK = 'How are you connected?'
export const IN_USE = 'In use now'
export const STILL_STUCK = 'Still stuck?'

/** What each way's fixes are about, a line each. */
export const troubleWays = () => [
  { key: 'adapter', title: 'Bluetooth adapter', sub: 'Lights, pairing and MIDI settings' },
  { key: 'cable', title: 'USB cable', sub: 'Plugs, cables and adapters' },
  { key: 'computer', title: 'A computer', sub: 'The app, the account and the cable' },
  { key: 'pi', title: 'Raspberry Pi', sub: 'It doesn’t show up, or can’t find your unit' }
]

/** Which way is in use now, for its row; null when nothing is connected. */
export function wayInUse({ bluetooth = false, cable = false, link = null } = {}) {
  if (cable) return 'cable'
  if (bluetooth) return 'adapter'
  if (link === 'connected') return 'computer'
  return null
}

/** The Pi's troubleshooting page: its title, and the guide's own list of fixes. */
export const PI_TROUBLE_PAGE = 'Raspberry Pi not working?'
export const PI_TROUBLE_URL = `${PI_GUIDE_URL}#trouble`
export const PI_MORE = 'All the fixes in the guide'
export const PI_COMPUTER_FIXES = 'Computer fixes'
export const PI_COMPUTER_FIXES_SUB = 'The Pi is a computer too: these help as well'
