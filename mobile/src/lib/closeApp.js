/*
 * HOW TO CLOSE THE APP COMPLETELY, said wherever the Bluetooth page tells
 * somebody to. Pure: a test runs it.
 *
 * "When it says close the app completely, we need to make it clear how to
 * do that on both Android and iPhone. On iPhone, you have to swipe up and
 * then swipe away. On Android, you tap the button at the bottom left, I
 * believe, and then swipe it. But it might be different per device" (Justin,
 * 19 November 2026). The pages said "(swipe it away)", which is the second
 * half of it: an app on screen has nothing to swipe away until the open
 * apps are showing.
 *
 * Each device is told its own way and no other's (Apple keeps other phones'
 * names out of an iPhone app, and the reverse is only noise). Android's
 * button differs by maker, so both common ways in are said, plainly.
 *
 * Kept on the phone: the sentences that say "close the app" are in files
 * the computer app shares, and are left word for word; this is one more
 * line under them.
 */

/** The steps for this kind of device. `os` is React Native's Platform.OS. */
export const howToClose = (os) =>
  os === 'ios'
    ? 'To close it: swipe up from the bottom edge of the screen and stop halfway, so your open apps show. Then swipe Fractal Remote up off the screen. With a Home button, press it twice instead of the first swipe.'
    : 'To close it: show your open apps (swipe up from the bottom of the screen and hold, or tap the square or three-lines button at the bottom). Then swipe Fractal Remote off the screen.'
