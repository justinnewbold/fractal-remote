/**
 * R8's OPTIMIZE PASS, which the SDK 57 template leaves switched off.
 *
 * Google Play, October 2026: "DEX code optimization is below our threshold.
 * Improve your percentages in the following categories: Obfuscation (3%)."
 * From February 2027 every upload needs 25% or more in each of obfuscation,
 * optimization and shrinking (support.google.com/googleplay/android-developer/answer/17492799).
 * expo-build-properties' enableMinifyInReleaseBuilds turns R8 on, which takes
 * care of obfuscation and shrinking. Optimization would still read about 0:
 * the template's release block asks for getDefaultProguardFile("proguard-android.txt"),
 * and AGP's copy of that file carries -dontoptimize, which no rule added after
 * it can undo (developer.android.com/topic/performance/app-optimization/enable-app-optimization).
 * expo-build-properties has no option for that line, so this swaps it for
 * proguard-android-optimize.txt, the file Expo's own SDK 58 template uses.
 *
 * It refuses rather than guesses: a template that names neither file has
 * changed shape, and a build that quietly kept -dontoptimize would fail Play's
 * check months later, after a build slot was spent on it.
 */
const { withAppBuildGradle } = require('expo/config-plugins')

const PLAIN = 'getDefaultProguardFile("proguard-android.txt")'
const OPTIMIZE = 'getDefaultProguardFile("proguard-android-optimize.txt")'

module.exports = function withR8Optimize(config) {
  return withAppBuildGradle(config, (c) => {
    const gradle = c.modResults.contents
    if (gradle.includes(OPTIMIZE)) return c
    if (!gradle.includes(PLAIN)) {
      throw new Error('withR8Optimize: android/app/build.gradle names neither proguard-android.txt nor proguard-android-optimize.txt; read the new template before building.')
    }
    c.modResults.contents = gradle.replace(PLAIN, OPTIMIZE)
    return c
  })
}
