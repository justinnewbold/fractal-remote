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

/*
 * What a handset can say about itself without a new package: which system
 * and its version, and on Android the maker and model React Native already
 * reports (Platform.constants). An iPhone says only whether it is an iPad.
 * Never the name somebody gave the device ("Justin's iPhone"). Read by the
 * gear notes (lib/gearShare) and a report's details (lib/reports context),
 * so the two say a phone the same way.
 */
export function deviceFacts() {
  const c = Platform.constants || {}
  let model = null
  if (Platform.OS === 'android') {
    const maker = typeof c.Manufacturer === 'string' ? c.Manufacturer : ''
    const name = typeof c.Model === 'string' ? c.Model : ''
    model = name && maker && !name.toLowerCase().startsWith(maker.toLowerCase()) ? `${maker} ${name}` : name || maker || null
  } else if (Platform.OS === 'ios') {
    model = DEVICE_KIND === 'ipad' ? 'iPad' : 'iPhone'
  }
  return {
    os: Platform.OS,
    osVersion: Platform.OS === 'android' && c.Release ? String(c.Release) : String(Platform.Version ?? ''),
    model
  }
}
