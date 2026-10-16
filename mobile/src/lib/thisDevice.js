import { Dimensions, Platform } from 'react-native'

import { appDevice, setDevice } from './device-word'

/**
 * WHICH DEVICE THIS IS, said once, before anything is drawn.
 *
 * "This app will work on phones, iPads, tablets … is there a way to detect
 * what device they're using and change what it says from phone to tablet or
 * iPad?" An iPad says so (Platform.isPad); an Android tablet is told by its
 * screen, the whole screen and not the window, so an app made narrow beside
 * another one is still on a tablet. See shared/device-word.mjs for the words.
 *
 * App.js imports this first. Everything that says "this phone" asks
 * device-word.js when it draws, so it reads what was set here.
 */
let screen = {}
try {
  screen = Dimensions.get('screen') || {}
} catch {
  // No screen to measure is a phone, as before.
}

export const DEVICE_KIND = setDevice(appDevice({ os: Platform.OS, pad: Platform.isPad === true, width: screen.width, height: screen.height }))
