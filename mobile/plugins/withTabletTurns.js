/**
 * ANDROID TABLETS TURN SIDEWAYS, AND ANDROID PHONES STAY UPRIGHT.
 *
 * Google Play, October 2026, on 1.88.0: "Remove resizability and orientation
 * restrictions in your app to support large screen devices." Justin: "The
 * large-screen change is the one most worth doing for reach, since a lot of
 * guitarists keep a tablet on a music stand." What Play reads is one line in
 * the Android manifest, MainActivity held upright
 * (android:screenOrientation="portrait"), which app.json's "orientation":
 * "portrait" writes there. An Android tablet on 12 to 15, held sideways,
 * shows the app as an upright strip with black bars at its sides; one on 7
 * to 11 turns its whole screen upright instead, so it has to be turned too.
 * Android 16 and newer already ignore the lock on a screen 600 dp or more
 * across (developer.android.com/about/versions/16/behavior-changes-16), and
 * an iPad has always turned every way.
 *
 * So, on Android only, this takes the lock out of the manifest and holds the
 * app upright from MainActivity instead, when the screen is a phone's. It is
 * Google's own recipe
 * (developer.android.com/develop/adaptive-apps/cookbook/orientation-restriction).
 * A phone is a screen whose short side is under 600 dp: the line Android
 * draws for a large screen, and the app's own TABLET_SIDE
 * (shared/device-word.mjs), by which the app calls itself a tablet
 * (mobile/src/lib/thisDevice.js). So the device the app calls a tablet is the
 * device that turns. app.json keeps "portrait", so an iPhone stays upright as
 * it always has and an iPad keeps the four ways it has (test/duo.mjs).
 *
 * THE SCREEN, NOT THE WINDOW. Google's recipe reads the window
 * (Configuration.screenWidthDp). This reads the whole screen the app is on:
 * the biggest the window could be (WindowManager.getMaximumWindowMetrics),
 * and before Android 11 the display's real size, which is what React
 * Native's Dimensions.get('screen') reads too (DisplayMetricsHolder), so
 * JavaScript and this agree. A tablet with the app beside another one, or a
 * Chromebook with its window made narrow, has a window as narrow as a
 * phone's, and the app must not be turned upright for that. Android ignores
 * the request in split screen, though not in every free-standing window,
 * such as a Chromebook's. On a foldable it is the screen that changes: shut, the
 * app is on the outside screen, a phone's, and is held upright; open, it is on
 * the inside screen, and turns. So the rule is asked again at every
 * configuration change, which is how a fold and an unfold arrive (MainActivity
 * is not made again for them: its configChanges include screenSize and
 * smallestScreenSize), as well as at every launch.
 *
 * WHY THE MANIFEST LOSES ITS LOCK, rather than keeping it and lifting it on a
 * tablet once the app starts. Kept, the manifest would still say what Play's
 * notice quotes, "screenOrientation=PORTRAIT", and an Android 12 to 15 tablet
 * could open as an upright strip and then jump to the full screen. Taken
 * out, there is one thing a phone can see: held sideways with auto-rotate on,
 * it may show the splash screen sideways for a blink before turning upright,
 * because Android draws the splash before any of the app's own code runs. A
 * phone held upright, or with auto-rotate off, sees nothing different. That
 * blink is the smaller of the two, and it is only at launch.
 *
 * It refuses rather than guesses, like withR8Optimize: a MainActivity that is
 * not Kotlin, has no super.onCreate, or already handles configuration changes
 * has changed shape, and a guess would build a phone that turns or a tablet
 * that does not, which only a store build would show.
 *
 * Nothing here touches the iPhone app: there is no iOS part. The plugin file
 * is hashed for both phones all the same, so it moves both fingerprints.
 */
const { withAndroidManifest, withMainActivity } = require('expo/config-plugins')

/** The app's TABLET_SIDE, in dp, written into the Kotlin (test/duo.mjs holds the two together). */
const TABLET_SIDE = 600

const BEGIN = '// withTabletTurns: begin (mobile/plugins/withTabletTurns.js says why)'
const END = '// withTabletTurns: end'

const RULE = `
  ${BEGIN}
  /*
   * Upright on a phone, every way up on a tablet. A screen whose short side
   * is under ${TABLET_SIDE} dp is a phone's (TABLET_SIDE in shared/device-word.mjs).
   * The whole screen, never the window, so a tablet beside another app is
   * still a tablet. Asked at launch and at every configuration change, which
   * is how a fold and an unfold arrive.
   */
  private fun holdPhonesUpright() {
    val wanted = if (screenShortSideDp() >= ${TABLET_SIDE}f) {
      android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    } else {
      android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    }
    if (requestedOrientation != wanted) requestedOrientation = wanted
  }

  @Suppress("DEPRECATION")
  private fun screenShortSideDp(): Float {
    val density = resources.displayMetrics.density
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
      val screen = windowManager.maximumWindowMetrics.bounds
      return minOf(screen.width(), screen.height()) / density
    }
    val real = android.util.DisplayMetrics()
    windowManager.defaultDisplay.getRealMetrics(real)
    return minOf(real.widthPixels, real.heightPixels) / density
  }

  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    super.onConfigurationChanged(newConfig)
    holdPhonesUpright()
  }
  ${END}
`

module.exports = function withTabletTurns(config) {
  config = withAndroidManifest(config, (c) => {
    const activities = c.modResults.manifest?.application?.[0]?.activity ?? []
    const main = activities.find((a) => /(^|\.)MainActivity$/.test(a?.$?.['android:name'] ?? ''))
    if (!main) throw new Error('withTabletTurns: the manifest has no MainActivity; read the new template before building.')
    delete main.$['android:screenOrientation']
    return c
  })
  return withMainActivity(config, (c) => {
    const src = c.modResults.contents
    if (src.includes(BEGIN)) return c
    if (c.modResults.language !== 'kt') {
      throw new Error('withTabletTurns: MainActivity is not Kotlin any more; read the new template before building.')
    }
    const calls = src.split('super.onCreate(').length - 1
    if (calls !== 1) {
      throw new Error(`withTabletTurns: MainActivity calls super.onCreate ${calls} times, not once; read the new template before building.`)
    }
    if (/\bonConfigurationChanged\b/.test(src)) {
      throw new Error('withTabletTurns: MainActivity already handles configuration changes; fold this rule into it by hand.')
    }
    const called = src.replace(/^([ \t]*)super\.onCreate\(/m, (line, indent) => `${indent}holdPhonesUpright()\n${line}`)
    if (called === src) throw new Error('withTabletTurns: super.onCreate is not on a line of its own.')
    const end = called.lastIndexOf('}')
    if (end < 0) throw new Error('withTabletTurns: MainActivity has no closing brace.')
    c.modResults.contents = `${called.slice(0, end).replace(/\s*$/, '\n')}${RULE}}\n`
    return c
  })
}
