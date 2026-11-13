/*
 * TONE3000 ON THIS DEVICE: lib/tone3000's client, handed the phone's own
 * storage, network and browser.
 *
 * THE PASS IS KEPT IN THE APP'S ORDINARY STORAGE, where the app's own
 * sign-in is kept. TONE3000's examples ask for the platform's secure
 * storage, which is a native package this build does not have; it comes
 * with the build that brings the in-app page. Until then this is drawn on
 * the Developer pages only, his account's.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Linking } from 'react-native'
import { tone3000 } from './tone3000'

const store = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key)
}

/** One client for the life of the app. */
export const t3k = tone3000({
  fetch: (...args) => globalThis.fetch(...args),
  store,
  open: (url) => Linking.openURL(url)
})

/**
 * Hear TONE3000 send the phone back: every link that reopens the app while
 * `heard` is listening, and the one that started the app if it was closed
 * while the browser was in front. `heard` gets the link; lib/tone3000
 * `finish` says whether it is TONE3000's (the Siri links are lib/siri's,
 * which takes no notice of this one). Returns the way to stop.
 */
export function onTone3000Return(heard) {
  let alive = true
  let sub = null
  try {
    sub = Linking.addEventListener('url', (event) => {
      if (alive && event?.url) heard(event.url)
    })
  } catch {
    sub = null
  }
  Promise.resolve()
    .then(() => Linking.getInitialURL())
    .then((url) => {
      if (alive && url) heard(url)
    })
    .catch(() => {})
  return () => {
    alive = false
    sub?.remove?.()
  }
}
