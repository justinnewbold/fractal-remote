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
  // Its own icon, on a light ground: Apple refused build 23 (guideline 4) because the
  // phone icon's black background stops a watch icon reading as a circle.
  icon: '../../assets/watch-icon.png',
  bundleIdentifier: '.watchkitapp',
  deploymentTarget: '10.0',
  frameworks: ['SwiftUI', 'WatchConnectivity', 'WatchKit']
}
