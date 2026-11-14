/*
 * THE THREE NATIVE PIECES TONE3000 INSIDE THE APP NEEDS, each one here only
 * where this copy of the app was built with it.
 *
 * "Have you built out the built-in tone 3000 into our app so you don't have
 * to go to Safari?" (Justin, 14 November 2026.) TONE3000's own examples for
 * a phone (github.com/tone-3000/api: ios/, android/ and react-native/) show
 * its page in a web view inside the app, rather than the phone's sign-in
 * sheet, which asks "Wants to Use ... to Sign In" every time; keep the pass
 * in the phone's secure storage; and make the one-time word from the
 * phone's secure random numbers. Those are three native packages:
 *
 *   react-native-webview   the page inside the app
 *   expo-secure-store      the Keychain, or the Android Keystore
 *   expo-crypto            secure random numbers
 *
 * A native package is a build, so they wait in
 * docs/pending/tone3000-in-app.patch, which adds them to the app and
 * nothing else. EVERYTHING THAT USES THEM IS ALREADY HERE, and asks this
 * file whether each one came: `null` on every copy built before that patch,
 * where TONE3000 opens in the browser, the pass is in the app's ordinary
 * storage and the one-time word is made as before, exactly as they were.
 *
 * WHY `require` INSIDE `try`, AND NOT `import`. A package that is not
 * installed cannot be imported: the app would not bundle. Asked for inside
 * a `try`, the bundler lets a missing one through (Expo sets
 * allowOptionalDependencies) and the app's own loader throws "Cannot find
 * module" when it is reached, which is caught here. And a package that IS
 * installed, on a copy whose native half is somehow missing, throws while
 * it loads: caught the same way, so the worst a mismatch can do is the
 * browser, never an app that will not start. Each needs a `try` of its own:
 * one missing must not take the other two with it.
 *
 * Nothing else in the app names these three packages (test/tone3000-page.mjs).
 */
let WebView = null
let SecureStore = null
let Crypto = null

try {
  const got = require('react-native-webview')
  WebView = got?.WebView || got?.default || null
} catch {
  WebView = null
}

try {
  const got = require('expo-secure-store')
  SecureStore = typeof got?.getItemAsync === 'function' && typeof got?.setItemAsync === 'function' && typeof got?.deleteItemAsync === 'function' ? got : null
} catch {
  SecureStore = null
}

try {
  const got = require('expo-crypto')
  Crypto = typeof got?.getRandomValues === 'function' ? got : null
} catch {
  Crypto = null
}

export { WebView, SecureStore, Crypto }
