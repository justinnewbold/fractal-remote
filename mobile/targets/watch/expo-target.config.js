/*
 * The Apple Watch app, built into the iPhone app by @bacons/apple-targets at
 * prebuild. Every Swift file in this folder is part of it; the same files are
 * built on their own by .github/workflows/watch.yml (mobile/watch-ci) so a
 * compile error is found on a free Mac, not in an Expo build.
 */
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  name: 'FractalWatch',
  displayName: 'Fractal',
  icon: '../../assets/icon.png',
  bundleIdentifier: '.watchkitapp',
  deploymentTarget: '10.0',
  frameworks: ['SwiftUI', 'WatchConnectivity']
}
