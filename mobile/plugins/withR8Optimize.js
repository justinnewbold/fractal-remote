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
 *
 * AND R8's RESOURCE SHRINKING. 1.88.0 scores about 83% on all three, and
 * since September 2026 Play's R8 card has asked other apps for two things
 * more (github.com/Selftend/selftend/issues/2335, quoting its own console;
 * if Justin's card says something different, this part's reason changes):
 * optimized resource shrinking, and an Android Gradle plugin of 9.0 or
 * newer, which only Expo SDK 58 brings. Justin: "R8 and the image fix are
 * quick wins at build time." expo-build-properties'
 * enableShrinkResourcesInReleaseBuilds
 * (app.json) turns resource shrinking on, and android.r8.optimizedResourceShrinking
 * makes it R8's own, which reads pictures and layouts as part of the code
 * and drops the ones only unused code asked for. On the Android Gradle
 * plugin this React Native brings, 8.12, it has to be switched on by hand;
 * from 9.0 it is the default (developer.android.com/build/shrink-code). Nothing in
 * expo-build-properties writes that line, so this does, and it acts only
 * while resource shrinking is on.
 *
 * What it must not drop is anything looked up by name, which no shrinker can
 * see in the code:
 *
 *   - The app's own pictures and sounds (drawable/assets_*, raw/assets_*),
 *     which React Native, expo-asset, expo-audio and expo-updates find by
 *     name. Expo's bundling writes res/raw/keep.xml naming every one of them
 *     (@expo/cli, persistMetroAssets), so they stay.
 *   - Three files Google Play's billing library brings for Google's own
 *     services to read, which nothing in the app's code names. A keep file of
 *     this app's own (KEEP below) holds them, so Google finds what it found in
 *     1.88.0.
 *
 * Everything else the app needs by name is named in its manifest or its
 * theme (the launcher icon, the splash picture, the runtime version), which
 * counts as used. android-minified builds the app and fails if any name in
 * either keep file is missing from it.
 */
const fs = require('fs')
const path = require('path')
const { withAppBuildGradle, withDangerousMod, withGradleProperties } = require('expo/config-plugins')

const PLAIN = 'getDefaultProguardFile("proguard-android.txt")'
const OPTIMIZE = 'getDefaultProguardFile("proguard-android-optimize.txt")'

const SHRINK = 'android.r8.optimizedResourceShrinking'

/* Keep files are read from every module at once, so this one carries the app's own package name. */
const KEEP_FILE = 'keep_cloud_newbold_fractalremote.xml'
const KEEP = [
  '@raw/com_android_billingclient_heterodyne_info',
  '@raw/com_android_billingclient_registration_info',
  '@xml/com_android_billingclient_phenotype'
]

module.exports = function withR8Optimize(config) {
  config = withAppBuildGradle(config, (c) => {
    const gradle = c.modResults.contents
    if (gradle.includes(OPTIMIZE)) return c
    if (!gradle.includes(PLAIN)) {
      throw new Error('withR8Optimize: android/app/build.gradle names neither proguard-android.txt nor proguard-android-optimize.txt; read the new template before building.')
    }
    c.modResults.contents = gradle.replace(PLAIN, OPTIMIZE)
    return c
  })
  config = withGradleProperties(config, (c) => {
    const props = c.modResults.filter((p) => !(p.type === 'property' && p.key === SHRINK))
    props.push({ type: 'property', key: SHRINK, value: 'true' })
    c.modResults = props
    return c
  })
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const raw = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw')
      await fs.promises.mkdir(raw, { recursive: true })
      await fs.promises.writeFile(
        path.join(raw, KEEP_FILE),
        `<?xml version="1.0" encoding="utf-8"?>\n<resources xmlns:tools="http://schemas.android.com/tools" tools:keep="${KEEP.join(',')}" />\n`
      )
      return c
    }
  ])
}
