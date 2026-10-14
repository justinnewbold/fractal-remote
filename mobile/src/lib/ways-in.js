/* Generated from shared/ways-in.mjs by scripts/sync-relay-rules.mjs.
 * Do not edit. Change the source and run `npm run sync:rules`; the test suite
 * fails on any difference between the two. */

/**
 * How to get a computer on the other end of this, and what each route costs.
 *
 * WHAT THIS IS FOR is the person holding a phone that says NO COMPUTER, who
 * has no idea a computer was ever part of the arrangement. Nothing in the app
 * said so: the sign-in screen asked for a code "your computer shows" and there
 * was no way from there to find out which computer, or how to make one show
 * anything.
 *
 * THREE ROUTES, ONE PER COMPUTER, AND ALL THREE ARE A DOWNLOAD. The page was
 * written when only the Mac app was real, and each route carries a `status`
 * for exactly that reason — so nobody is sent looking for a download that was
 * never built. What is left is the honest difference between them: the Mac app
 * is signed by Apple and opens without argument, the Windows app is not signed
 * yet and Windows says so in a blue box, and Linux gets an AppImage that
 * updates itself plus a .deb that does not, each for an ordinary PC and for a
 * Raspberry Pi on the 64-bit Raspberry Pi OS.
 *
 * THE TWO TERMINAL ROUTES ARE GONE, and the reason is worth keeping because it
 * is the reason not to write them again.
 *
 * They pasted one line into a shell and built the device server from source,
 * which reads like the expert's shortcut. It never was one. The line fetched
 * three private repositories, so it stopped at the first `git fetch` for
 * everybody on earth except the person holding the token — and the steps had
 * to say "ask Justin for one" out loud, which is not a route, it is a
 * correspondence. The apps carry that same server inside them, signed and
 * vendored at build time, and they now cover all three computers. A route
 * whose first instruction is to email the author is worse than no route:
 * it costs a reader their time before it tells them it cannot help.
 *
 * So there is no tokenless version of this idea to go back and build. The
 * download IS the tokenless version.
 */

import { FRACTAL_DOWNLOADS, WINDOWS_DRIVER, quitEditor } from './editors.js'

/*
 * The list, not `/releases/latest`.
 *
 * `/latest` means "the newest release of any kind", and this repository also
 * publishes an Android build on nearly every merge — so the download link
 * aimed at the Mac app landed on an .apk. The list page shows all of them with
 * their names, and the step below says which file to take.
 */
/**
 * WHERE THIS CODE ACTUALLY LIVES, in one place, because three things point at
 * it and none of them can be wrong.
 *
 * The download link the apps offer, the Mac app's own menu, and
 * electron-builder's publish block — which is BOTH where a release uploads
 * and where an installed Mac app looks for the next version.
 *
 * THE RENAME HAPPENED. "github and vercel rename are completed" — so this
 * says fractal-remote, which is what the prose here has said all along.
 *
 * It was pinned to the old name for a reason worth keeping written down: a
 * name that has never existed does not redirect, it 404s. Changing it early
 * published a desktop build at a repository that was not there and shipped a
 * Download link that went nowhere. The check before this moved was the old
 * name answering "Moved Permanently" from GitHub's API, which only happens
 * once a rename is real.
 *
 * GitHub redirects the OLD name from here on, so every link already in the
 * world — an installed Mac app looking for its next version, a Download
 * button on a page somebody bookmarked — keeps working.
 */
export const REPO = 'justinnewbold/fractal-remote'

export const RELEASES = `https://github.com/${REPO}/releases`

/**
 * `ready` is a thing you can download and run today.
 * `planned` does not exist — say so, and say what to do instead.
 */
export const WAYS = [
  {
    id: 'mac-app',
    os: 'mac',
    title: 'The Mac app',
    status: 'ready',
    note: 'Ready now — this is the easy one',
    steps: [
      'On the Mac, open the download page below and take the newest file ending in .dmg.',
      'Drag it to Applications and open it.',
      'Plug your unit into the Mac with its USB cable.',
      quitEditor(null),
      'In the app, choose Set up phone remote and sign in. Make an account there if you have not got one.',
      'On your phone, get Fractal Remote from the App Store or Google Play and sign in with that same account. That is the whole of it.'
    ],
    links: [{ label: 'Download Fractal Remote for Mac', url: RELEASES }]
  },
  {
    id: 'windows-app',
    os: 'windows',
    title: 'The Windows app',
    status: 'ready',
    note: 'Ready now — Windows will warn about it, and that is expected',
    steps: [
      'On the PC, open the download page below and take the newest file ending in .exe.',
      'Open it. Windows shows a blue box that says "Windows protected your PC" — click More info, then Run anyway. It says that because the installer is not signed yet, not because anything is wrong with it.',
      WINDOWS_DRIVER,
      'Plug your unit into the PC with its USB cable.',
      quitEditor(null),
      'The first time it starts its server, Windows asks whether to allow it through the firewall. Say yes, or your phone cannot reach this computer over wifi.',
      'In the app, choose Set up phone remote and sign in, then sign in on the phone with that same account. Same as the Mac.'
    ],
    links: [
      { label: 'Download Fractal Remote for Windows', url: RELEASES },
      { label: "Fractal's downloads, for the USB driver", url: FRACTAL_DOWNLOADS }
    ]
  },
  {
    id: 'linux-app',
    os: 'linux',
    title: 'The Linux app',
    status: 'ready',
    note: 'Ready now — and the one to use on a box that lives in the rack',
    /*
     * Changed on purpose, 12 October 2026. These said the AppImage "works on
     * any Linux" and that "a Raspberry Pi works", and a customer on a Pi 3
     * took the PC AppImage on the strength of it. A Pi cannot run that file,
     * and there is no build at all for the 32-bit Raspberry Pi OS. What is
     * true is narrower, and it is what these say now: the Raspberry Pi
     * AppImage (arm64 in its name), on the 64-bit Raspberry Pi OS. The link
     * goes to the download page rather than the GitHub list, because that
     * page labels the Pi files and the list does not, and the steps name the
     * files by those labels for the same reason.
     *
     * The packages are for a trimmed-down system WITH a desktop. Raspberry Pi
     * OS Lite on its own has none, and the app opens a window: with the
     * packages it gets one error further and stops at "Missing X server or
     * $DISPLAY". Nothing here says Lite alone can run it until the app can
     * run with no desktop at all. (Since 1.87.16 it can start with no
     * window, but it still starts inside a desktop, so that has not changed.)
     */
    steps: [
      'On an ordinary PC, take the Linux PC AppImage from the download page below. The AppImage is the one that keeps itself up to date.',
      'On a Raspberry Pi, take the Raspberry Pi AppImage (its file name has arm64 in it). It needs the 64-bit Raspberry Pi OS: open Terminal and type dpkg --print-architecture. If it says arm64, you are set. If it says armhf, the Pi is running the 32-bit one, which none of the files run on — put Raspberry Pi OS (64-bit) on it with Raspberry Pi Imager. That wipes the memory card, so copy off anything you want to keep first. A Pi 4, 5, 400, 500 or 500+ with 2 GB or more is best, and a Pi 3 is slower. A Zero 2 W or Pi 3 A+ isn’t recommended: 512 MB is very likely too little.',
      'On a trimmed-down system, such as Raspberry Pi OS Lite with a desktop added, install two packages first: sudo apt install libfuse2t64 zlib1g-dev (on the older Bookworm release, libfuse2 in place of libfuse2t64).',
      "Make the AppImage executable and open it. Right-click it, choose Properties, and on the Permissions tab set Execute to Anyone (on other computers, tick the box that lets it run as a program). Or in Terminal, type cd Downloads, then chmod +x followed by the file's name. If double-clicking it does nothing, type ./ followed by the file's name in that same Terminal, and it says why.",
      "Or take the .deb for your machine (Linux PC or Raspberry Pi) instead. In Terminal, type cd Downloads, then sudo apt install ./the-file.deb with the file's own name in place of the-file.deb. The .deb updates itself too, but only when you quit the app, and it may ask for your password, so the AppImage is the easier one. If the phone says the computer app needs updating, quit the app, or install the new .deb the same way.",
      'Plug your unit into the machine with its USB cable.',
      'You may need permission to use the USB port. If the app says it cannot find your unit, run: sudo usermod -aG dialout $USER — then log out and back in. Most distributions keep serial ports behind that group, and it catches nearly everybody once.',
      'In the app, choose Set up phone remote and sign in, then sign in on the phone with that same account.',
      /*
       * Added 12 October 2026, with the switch it names. A Pi on a pedalboard
       * has no screen, so the one-time setup needs one plugged in (or the
       * Pi's own screen sharing), and after that the app starts itself with
       * no window. It still needs the desktop: Raspberry Pi OS logs itself in
       * to it at power-on by default, which is what Desktop Autologin is.
       *
       * The AppImage, said outright, because a pedalboard is switched off at
       * the wall: the AppImage installs its updates just after power-on with
       * nobody there, and the .deb waits for somebody to quit it and type a
       * password, which on a box with no screen never happens. And the file
       * stays where it is, because a downloaded file looks like an installer
       * to tidy away and here it is the app itself.
       */
      'For a Raspberry Pi that lives on your pedalboard with no screen, take the Raspberry Pi AppImage, not the .deb: the AppImage updates itself with nobody there, and the .deb only updates when somebody quits it and types a password. Plug a screen in once (or use Raspberry Pi Connect or VNC), open the app and sign in as above, then in the app go to Settings, then About, and switch on Start when this computer turns on. From then on the app starts by itself, with no window, every time the Pi is switched on. Leave the AppImage file where it is, because it is the app itself; if you move it, open it once from its new place. It needs the 64-bit Raspberry Pi OS with the desktop, with Desktop Autologin left on, which it is unless you changed it.'
    ],
    /*
     * The Pi guide as well, 14 October 2026: the steps above are one
     * paragraph each for somebody who knows a Pi, and the guide is every
     * step for somebody who has never used one, from the memory card on.
     * The download page stays first, because it is what the steps name.
     */
    links: [
      { label: 'Download Fractal Remote for Linux', url: 'https://fractal.newbold.cloud/downloads' },
      { label: 'Set up a Raspberry Pi, step by step', url: 'https://fractal.newbold.cloud/raspberry-pi' }
    ]
  },
]

export const wayById = (id) => WAYS.find((w) => w.id === id) || null

/**
 * How many routes there are, as the word a sentence needs.
 *
 * Counted rather than typed. Both apps said "Four ways" for weeks after the
 * fourth one — running the device server from a terminal — was taken out, and
 * a number in prose has no way of noticing that the list under it changed.
 * "There is only 3 ways to connect. Mac, Windows or Linux. We removed the
 * terminal."
 */
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six']
export const waysWord = (list = WAYS) => WORDS[list.length] || String(list.length)

/**
 * Which computer this browser is running on.
 *
 * TAKES THE USER AGENT RATHER THAN REACHING FOR ONE. This module is bundled by
 * the phone app, and a phone has no `navigator.userAgent` to read — a module
 * that names it bundles, installs, and throws the first time that line runs.
 * The browser passes its own; the phone never calls this at all, for the
 * reason in `waysFor`.
 *
 * `null` for anything it cannot place, which includes every phone — and that
 * is the important case, not an edge one.
 */
export function osGuess(ua = '') {
  const s = String(ua || '')
  if (/Windows NT|Win64|WOW64/i.test(s)) return 'windows'
  /* iPhone and iPad first: an iPad's user agent says Macintosh. */
  if (/iPhone|iPad|iPod|Android/i.test(s)) return null
  if (/Macintosh|Mac OS X/i.test(s)) return 'mac'
  /*
   * Linux last, and only after the handsets have been ruled out above.
   * Android's user agent says "Linux" — every one of them — so testing for it
   * any earlier would tell a phone it was a desktop and offer it an AppImage.
   *
   * ChromeOS is deliberately not counted. It says CrOS and it is Linux
   * underneath, but its Linux environment is a container and getting a USB
   * device through to it varies by machine; offering a download that probably
   * cannot reach the unit is worse than leaving the page unsorted. It needs
   * its own line because a Chromebook's user agent reads "X11; CrOS" — the
   * Linux test below matches it, so the exclusion has to come first.
   */
  if (/CrOS/i.test(s)) return null
  if (/Linux|X11/i.test(s)) return 'linux'
  return null
}

/**
 * The routes, with the ones for this computer first.
 *
 * AND ON A PHONE, NOTHING IS REORDERED, which is the part worth being careful
 * about. This page is about which COMPUTER somebody is going to plug their
 * unit into. In a browser that question is answered by the browser itself —
 * you are reading this on the machine in question. On a handset it is not:
 * knowing the app is running on an iPhone says nothing about whether there is
 * a Mac or a PC on the desk, and putting the Mac routes first because somebody
 * owns an iPhone would be a guess dressed as an answer.
 *
 * So `os` of null leaves the order alone, and the order it leaves alone opens
 * on the one route that exists today.
 */
export function waysFor(os = null) {
  if (!os) return WAYS.slice()
  /*
   * And within this computer's own routes, the ones that WORK come first.
   *
   * Sorting on the operating system alone put "The Windows app — not built
   * yet" at the top of the page for every Windows visitor, which is a page
   * that opens by telling you it cannot help you. Both Windows routes work
   * now, so the sort no longer changes their order — it stays because the
   * next route to be written will start out `planned` too, and the page
   * should not open on it.
   */
  const works = (w) => (w.status === 'planned' ? 1 : 0)
  const mine = WAYS.filter((w) => w.os === os).sort((a, b) => works(a) - works(b))
  return [...mine, ...WAYS.filter((w) => w.os !== os)]
}
