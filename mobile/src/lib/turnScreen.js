/*
 * ASKING THE PHONE TO STAY UPRIGHT, OR LETTING IT TURN.
 *
 * lib/phoneTurns says what is wanted; this is the one place that asks the
 * phone for it, through expo-screen-orientation. Three things can be asked:
 *
 *   upright   held upright, and nothing else (the package's PORTRAIT_UP).
 *   turns     upright or on either side, never upside down. On the iPhone
 *             that is the package's DEFAULT (every way but upside down). On
 *             Android it is NOT: its DEFAULT is "unspecified", which is what
 *             plugins/withTabletTurns takes for nothing asked, and it would
 *             put the phone upright again the moment it turned. So Android
 *             is asked for the phone's own choice ("user", ANDROID_USER):
 *             it turns if the phone's auto-rotate is on, stays as the phone
 *             is locked if it is off, and is never upside down on a phone.
 *   release   nothing asked any more (DEFAULT on both): only ever for a fold
 *             that was a phone when it was asked and is a tablet now.
 *
 * A FAILURE IS A LINE IN THE LOG AND NOTHING ELSE. The package's native part
 * is reached the way the app reaches every part a build may lack (expo's
 * requireOptionalNativeModule, as lib/siriPipe and lib/storeVersion do),
 * never through the package's own front door, which throws while the app is
 * still loading its files if the part is missing. A copy of the app built
 * without it cannot be turned, says so once, and carries on as it was built.
 * A lock the phone refuses is logged and left: the page is still there, the
 * way up it was.
 *
 * The package's own names for the locks are imported from the one file of it
 * that holds nothing but names, so what is asked for is PORTRAIT_UP and
 * DEFAULT by name and never a bare number (test/phone-turns.mjs holds this
 * file to that).
 *
 * AND AFTER EVERY ASK THE PHONE TAKES, THE LOG SAYS WHAT THE PHONE HOLDS
 * (`sayTurn`, since 17 November 2026). "It does not turn it all." (Justin,
 * that day, his iPhone 17 Pro Max on iOS 27 with the 2.0.0 test build, on
 * Play): his log of the day before had "turning: turns" and nothing more,
 * which says the app asked and the package took it, and not what iOS was
 * then told. So the package is asked straight back, in its own numbers,
 * and the answer is written beside what was asked. It only reads, and
 * nothing is done with the answer.
 *
 * The three numbers are asked for together, and the package answers them
 * back to back, so no other ask of the package comes between them. A turn
 * of the phone itself still can, and on Android so can the app's own
 * hold-upright, so way up may be a moment newer than lock and ways. The
 * line is taken just after the ask it names, and a later ask may already
 * be in it (at launch "upright" and "turns" come a moment apart): the LAST
 * line is the one that says what the phone was left holding.
 *
 *   lock     the package's name for every way up the app allows now.
 *            On the iPhone that is what the app's window answers iOS when
 *            it asks: 0 every way but upside down, 3 upright only, 8 none
 *            of the package's names (WITH "ways none": when the phone was
 *            asked, the app had no key window, so at that moment it would
 *            have answered iOS with no way up; iOS asks again on its own,
 *            and may get another answer then), 9 not known.
 *            On Android it is the screen's setting in the package's names:
 *            0 nothing asked, 3 upright, 8 the phone's own choice (the
 *            package has no name for it).
 *   ways     the same, one by one: 1 upright, 2 upside down, 3 and 4 the
 *            two sides. On Android it is one number, the screen's own
 *            setting (2 the phone's choice, 1 upright, -1 nothing asked).
 *   way up   the way up the package has on record (1 to 4 as above, 0 not
 *            known). On Android that is read from the screen as it is
 *            asked. On the iPhone it is the package's own note: read from
 *            the window once at launch (0 if there was no window yet),
 *            then set by each turn its screen sees (0 when it cannot tell
 *            which way), and, by any ask made while it is 0, to the way
 *            that ask allows (upright, for "upright" and "turns"). It is
 *            not looked up when asked, so "way up 1" does not prove the
 *            app is drawn upright; the component's own line for a turn
 *            (the app is on its side now, with the window's size) does.
 *
 * After "turns" a healthy iPhone says "lock 0, ways 1,3,4", and a healthy
 * Android phone "lock 8, ways 2". On an iPhone, "lock 3, ways 1" after
 * "turns" is the app held upright all the same: by something else that
 * asked, or because the package holds nothing of this app's and has fallen
 * back to how the app starts. "lock 8, ways none" is no key window found at
 * the moment of asking. And "lock 0, ways 1,3,4" on a phone that still does
 * not turn is iOS not acting on what it was told, which is also exactly how
 * the phone's own Portrait Orientation Lock looks from in here: the app
 * cannot see that lock.
 */
import { requireOptionalNativeModule } from 'expo'
import { OrientationLock } from 'expo-screen-orientation/build/ScreenOrientation.types'
import { Platform } from 'react-native'

import { logDebug } from './debugLog'
import { RELEASE, TURNS, UPRIGHT } from './phoneTurns'

/** Android's ActivityInfo.SCREEN_ORIENTATION_USER: the phone's own choice, by its auto-rotate switch. */
export const ANDROID_USER = 2

/* undefined: not asked for yet. null: not in this copy of the app. */
let native

function orientation() {
  if (native !== undefined) return native
  try {
    native = requireOptionalNativeModule('ExpoScreenOrientation')
    if (typeof native?.lockAsync !== 'function') native = null
  } catch {
    native = null
  }
  if (!native) logDebug('app', 'turning: this copy has no screen orientation module, so it stays as it was built')
  return native
}

/**
 * Ask the phone for UPRIGHT, TURNS or RELEASE. Answers true when the phone
 * took it, false when it did not (and has said why in the log). Never throws.
 */
export async function askTurn(step) {
  if (step !== UPRIGHT && step !== TURNS && step !== RELEASE) return false
  const so = orientation()
  if (!so) return false
  try {
    if (step === UPRIGHT) await so.lockAsync(OrientationLock.PORTRAIT_UP)
    else if (step === TURNS && Platform.OS === 'android') await so.lockPlatformAsync(ANDROID_USER)
    else await so.lockAsync(OrientationLock.DEFAULT)
    logDebug('app', `turning: ${step}`)
    sayTurn(`after "${step}"`)
    return true
  } catch (e) {
    logDebug('app', `turning: the phone would not take "${step}"`, String(e?.message || e))
    return false
  }
}

/**
 * What the phone holds now, in the package's own numbers ("lock 0, ways
 * 1,3,4, way up 1"), or null in a copy built without the package. The three
 * are asked for TOGETHER, before any has answered: the package answers in
 * the order it is asked, so nothing asked of the phone meanwhile can come
 * between them. A turn of the phone itself (and on Android the app's own
 * hold-upright) still can, so way up may be a moment newer than lock and
 * ways. Each has its own guard, so one that fails says so in its place and
 * the others are still read. Never throws.
 */
export async function turnHeld() {
  const so = orientation()
  if (!so) return null
  const read = async (name) => {
    try {
      if (typeof so[name] !== 'function') return 'not in this copy'
      const got = await so[name]()
      if (Array.isArray(got)) return got.length ? got.join(',') : 'none'
      return String(got)
    } catch (e) {
      return `not said (${String(e?.message || e)})`
    }
  }
  const [lock, ways, up] = await Promise.all([read('getOrientationLockAsync'), read('getPlatformOrientationLockAsync'), read('getOrientationAsync')])
  return `lock ${lock}, ways ${ways}, way up ${up}`
}

/**
 * One line in the log: what has just happened (`what`), and what the phone
 * holds now. Nothing is asked of the phone but to say. Never throws, and
 * says nothing in a copy built without the package (which has said so once).
 */
export async function sayTurn(what) {
  try {
    const held = await turnHeld()
    if (held) logDebug('app', `turning: ${what}`, `the phone holds ${held}`)
  } catch {
    /* A line in the log is never worth the screen's own work. */
  }
}
