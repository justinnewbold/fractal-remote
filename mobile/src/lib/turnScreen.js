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
    return true
  } catch (e) {
    logDebug('app', `turning: the phone would not take "${step}"`, String(e?.message || e))
    return false
  }
}
