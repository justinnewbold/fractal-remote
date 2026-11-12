/**
 * Which way up a phone may be held: upright everywhere, and on either side
 * on Play, for an account the sideways layout is open to.
 *
 * "Landscape mode on iPhone is not working." (Justin, 10 November 2026.)
 * Play on a phone held on its side had been built to split in two, and no
 * phone could be turned to see it: an iPhone was held upright by app.json,
 * an Android phone by plugins/withTabletTurns at every turn. The build that
 * carries these files lets a phone turn, by one rule (lib/phoneTurns) that
 * the app applies itself through expo-screen-orientation (lib/turnScreen,
 * components/PhoneTurns), and a tablet is asked for nothing.
 *
 * Nothing here turns a phone, so the rule is RUN, over phones and tablets,
 * every screen and both kinds of account; the one file that talks to the
 * phone is RUN against stand-ins for the phone; and the config, the plugin
 * and the wiring are READ. What a real phone does with it is the first look
 * on one (docs/pending/README.md says what to look at).
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const there = (p) => existsSync(new URL(`../${p}`, import.meta.url))
/* Comments out, so a check reads the code and not its explanation. */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
const flat = (src) => code(src).replace(/\s+/g, ' ')

/** A phone file run as it is: a copy as .mjs, since the phone's .js is not a module to node. */
async function load(src, name) {
  const dir = mkdtempSync(join(tmpdir(), 'phone-turns-'))
  try {
    const file = join(dir, `${name}.mjs`)
    writeFileSync(file, src)
    return await import(pathToFileURL(file).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** lib/phoneTurns, run. It imports nothing. */
async function rule() {
  const src = read('mobile/src/lib/phoneTurns.js')
  assert.ok(!/^import /m.test(src), 'lib/phoneTurns imports something, and this check runs it alone')
  return load(src, 'phoneTurns')
}

/**
 * lib/turnScreen, run against stand-ins: its four imports are taken out and
 * handed in, so what it asks the phone for is seen and nothing is turned.
 * `native` is the package's native part (null: a copy built without it),
 * `os` the phone. Answers the file's own exports, what was asked and what
 * was logged.
 */
async function talker({ native, os = 'ios', throwsOnFind = false } = {}, r) {
  const src = read('mobile/src/lib/turnScreen.js')
  const imports = src.match(/^import [^\n]+$/gm)
  assert.deepEqual(
    imports,
    [
      "import { requireOptionalNativeModule } from 'expo'",
      "import { OrientationLock } from 'expo-screen-orientation/build/ScreenOrientation.types'",
      "import { Platform } from 'react-native'",
      "import { logDebug } from './debugLog'",
      "import { RELEASE, TURNS, UPRIGHT } from './phoneTurns'"
    ],
    'lib/turnScreen imports something else; hand it in here'
  )
  const log = []
  const finds = []
  globalThis.__turns = {
    requireOptionalNativeModule: (name) => {
      finds.push(name)
      if (throwsOnFind) throw new Error('no modules at all')
      return native
    },
    OrientationLock: { DEFAULT: 0, PORTRAIT_UP: 3 },
    Platform: { OS: os },
    logDebug: (source, message, detail) => log.push({ source, message, detail }),
    RELEASE: r.RELEASE,
    TURNS: r.TURNS,
    UPRIGHT: r.UPRIGHT
  }
  const stood = `const { requireOptionalNativeModule, OrientationLock, Platform, logDebug, RELEASE, TURNS, UPRIGHT } = globalThis.__turns\n${src.replace(/^import [^\n]+$/gm, '')}`
  const made = await load(stood, 'turnScreen')
  return { ...made, log, finds }
}

/** A stand-in for the package's native part, which writes down what it is asked. */
function phone({ refuses = false } = {}) {
  const asked = []
  const take = (what) => async (value) => {
    asked.push([what, value])
    if (refuses) throw new Error('the phone said no')
  }
  return { asked, lockAsync: take('lockAsync'), lockPlatformAsync: take('lockPlatformAsync') }
}

/* The phones and tablets the rule is asked about: the whole screen in points, upright, with what each keeps clear over and under it there. */
const IPHONES = [
  /* name, width, height, top, bottom, across on its side, splits */
  ['an iPhone 17 Pro Max', 440, 956, 62, 34, 832, true],
  ['an iPhone 16 Plus', 430, 932, 59, 34, 814, true],
  ['an iPhone 17', 393, 852, 59, 34, 734, true],
  ['an iPhone 16e', 390, 844, 47, 34, 750, true],
  ['an iPhone 13 mini', 375, 812, 50, 34, 712, false],
  ['an iPhone 8 Plus', 414, 736, 20, 0, 736, true],
  ['an iPhone SE', 375, 667, 20, 0, 667, false]
]
const ANDROIDS = [
  ['a Pixel 8, swiping', 411.43, 914.29, 38, 24, 876.29, true],
  ['a Pixel 8, three buttons', 411.43, 914.29, 38, 48, 828.29, true],
  ['a 780-point Galaxy, swiping', 360, 780, 32, 16, 748, true],
  ['a 780-point Galaxy, three buttons', 360, 780, 32, 48, 700, false],
  ['an 800-point Galaxy, three buttons', 360, 800, 32, 48, 720, true],
  ['a small 640-point phone', 360, 640, 24, 48, 568, false]
]

export function run(test) {
  test('phone turns: a tablet is asked for nothing, on any screen, for any account', async () => {
    const r = await rule()
    /* The app's own tablet line, the one Android is told, and this rule's: one number. */
    const { TABLET_SIDE } = await import('../shared/device-word.mjs')
    assert.equal(r.TABLET_SIDE, TABLET_SIDE, 'this rule calls a screen a tablet at a different size from the app')
    assert.match(read('mobile/plugins/withTabletTurns.js'), new RegExp(`^const TABLET_SIDE = ${TABLET_SIDE}$`, 'm'), 'Android turns at a different size from this rule')
    /* An iPad is one whatever its size says; anything else by the whole screen's short side, either way up. */
    for (const [what, device, tablet] of [
      ['an iPad mini', { pad: true, width: 744, height: 1133 }, true],
      ['an iPad in a report with no size', { pad: true }, true],
      ['an Android tablet upright', { width: 800, height: 1280 }, true],
      ['an Android tablet on its side', { width: 1280, height: 800 }, true],
      ['a Galaxy Fold opened', { width: 673, height: 841 }, true],
      ['a screen exactly at the line', { width: 600, height: 960 }, true],
      ['a screen a point under it', { width: 599, height: 960 }, false],
      ['a Galaxy Fold shut', { width: 344, height: 882 }, false],
      ['an iPhone 17 Pro Max upright', { width: 440, height: 956 }, false],
      ['an iPhone 17 Pro Max on its side', { width: 956, height: 440 }, false],
      ['nothing measured', {}, false]
    ]) {
      assert.equal(r.isTablet(device), tablet, what)
    }
    for (const allowed of [true, false]) {
      for (const inApp of [true, false]) {
        for (const [onPlay, beside, stageView] of [
          [true, false, false],
          [false, true, false],
          [false, false, true],
          [false, false, false]
        ]) {
          assert.equal(r.turnsWanted({ tablet: true, allowed, fits: true, inApp, onPlay, beside, stageView }), null, 'something is asked of a tablet')
        }
      }
    }
    /* And nothing is told to it, except to let go of what was asked while the screen was a phone's (a fold opened with the app up). */
    assert.equal(r.turnStep(null, null), null)
    assert.equal(r.turnStep(r.UPRIGHT, null), r.RELEASE)
    assert.equal(r.turnStep(r.TURNS, null), r.RELEASE)
  })

  test('phone turns: a phone is upright on every screen but Play, what opens beside it and Stage view, and there only for an account the sideways layout is open to', async () => {
    const r = await rule()
    const SCREENS = [
      /* what, { inApp, onPlay, beside, stageView }, may turn */
      ['Play', { inApp: true, onPlay: true }, true],
      ['the wait for a rig in Play’s place', { inApp: true, onPlay: true }, true],
      ['Edit', { inApp: true, beside: true }, true],
      ['Setlists', { inApp: true, beside: true }, true],
      ['All presets', { inApp: true, beside: true }, true],
      ['the tuner in a side', { inApp: true, beside: true }, true],
      ['Notes', { inApp: true, beside: true }, true],
      ['a held block’s knobs', { inApp: true, beside: true }, true],
      ['Stage view', { inApp: true, stageView: true }, true],
      ['Settings and every page in it', { inApp: true }, false],
      ['Bluetooth', { inApp: true }, false],
      ['Troubleshooting', { inApp: true }, false],
      ['a report', { inApp: true }, false],
      ['the log', { inApp: true }, false],
      ['Gear', { inApp: true }, false],
      ['Connect a computer', { inApp: true }, false],
      /* In front of the app: whatever screen is behind them, they are upright. */
      ['the startup card over Play', { inApp: false, onPlay: true }, false],
      ['the walkthrough', { inApp: false, onPlay: true }, false],
      ['the sign-in', { inApp: false, onPlay: true }, false],
      ['the purchase page', { inApp: false, onPlay: true }, false],
      ['the purchase page opened over Edit', { inApp: false, beside: true }, false],
      ['How do you connect to your unit?', { inApp: false, onPlay: true }, false],
      ['the sharing card', { inApp: false, onPlay: true }, false]
    ]
    for (const [what, where, turns] of SCREENS) {
      /* An account it is open to, on a phone long enough. */
      assert.equal(r.turnsWanted({ tablet: false, allowed: true, fits: true, ...where }), turns ? r.TURNS : r.UPRIGHT, `${what}, his account`)
      /* Every other account: upright everywhere, Play among them, as the app was. */
      assert.equal(r.turnsWanted({ tablet: false, allowed: false, fits: true, ...where }), r.UPRIGHT, `${what}, an account the sideways layout is closed to`)
      /* And a phone too short to split: upright everywhere, never Play stretched. */
      assert.equal(r.turnsWanted({ tablet: false, allowed: true, fits: false, ...where }), r.UPRIGHT, `${what}, a phone too short to split`)
    }
    /* Asked with nothing: upright, never a guess the other way. */
    assert.equal(r.turnsWanted(), r.UPRIGHT)
    assert.equal(r.turnsWanted({}), r.UPRIGHT)
    /* Only `true` opens anything. */
    assert.equal(r.turnsWanted({ allowed: 'yes', fits: 1, inApp: 1, onPlay: 1 }), r.UPRIGHT)
    /* The answers are two words and nothing: never upside down, never "sideways only". */
    assert.deepEqual([r.UPRIGHT, r.TURNS, r.RELEASE], ['upright', 'turns', 'release'])
  })

  test('phone turns: the phone is told only when the answer changes, and Settings from Play on its side is upright and back', async () => {
    const r = await rule()
    /* The app starts on a phone: upright asked once; the same answer again asks nothing. */
    assert.equal(r.turnStep(null, r.UPRIGHT), r.UPRIGHT)
    assert.equal(r.turnStep(r.UPRIGHT, r.UPRIGHT), null)
    /* Play comes up for his account; Settings opens; back to Play. */
    assert.equal(r.turnStep(r.UPRIGHT, r.TURNS), r.TURNS)
    assert.equal(r.turnStep(r.TURNS, r.TURNS), null)
    assert.equal(r.turnStep(r.TURNS, r.UPRIGHT), r.UPRIGHT)
    assert.equal(r.turnStep(r.UPRIGHT, r.TURNS), r.TURNS)
    /* A fold shut again, after its time as a tablet: nothing is in force, so it is asked afresh. */
    assert.equal(r.turnStep(null, r.TURNS), r.TURNS)
    /* Anything that is not one of the two words is a tablet's nothing. */
    assert.equal(r.turnStep(null, 'sideways'), null)
    assert.equal(r.turnStep(r.TURNS, undefined), r.RELEASE)
  })

  test('phone turns: only a phone long enough to split turns, worked out upright and checked against what it measures on its side', async () => {
    const r = await rule()
    /* The line is the one a phone on its side splits at. */
    const sides = read('mobile/src/lib/twoSides.js')
    assert.match(sides, new RegExp(`^export const SIDEWAYS_AT = ${r.SIDEWAYS_AT}$`, 'm'), 'this rule turns a phone at a different width from the one it splits at')
    for (const [what, width, height, top, bottom, across, splits] of IPHONES) {
      assert.equal(r.sidewaysAcross({ os: 'ios', width, height, top, bottom }), across, `${what}: across on its side`)
      /* Asked while it is on its side with the same numbers, the long side is still the long side. */
      assert.equal(r.sidewaysAcross({ os: 'ios', width: height, height: width, top, bottom }), across)
      assert.equal(r.fitsSideways(across), splits, what)
    }
    for (const [what, width, height, top, bottom, across, splits] of ANDROIDS) {
      assert.ok(Math.abs(r.sidewaysAcross({ os: 'android', width, height, top, bottom }) - across) < 0.01, `${what}: across on its side`)
      assert.equal(r.fitsSideways(across), splits, what)
    }
    /* What the sum says is what lib/twoSides then splits: the same phones, the same answer, with the room the sides tests take off the height. */
    const two = await load(read('mobile/src/lib/twoSides.js'), 'twoSides')
    for (const [what, width, height, top, bottom, across, splits] of [...IPHONES, ...ANDROIDS]) {
      assert.equal(two.phoneSidewaysOn({ width: across, height: width - 108 }), splits, `${what} turns and does not split, or splits and is not let turn`)
    }
    /* Nothing measured: nothing across, so upright. */
    assert.equal(r.sidewaysAcross(), 0)
    assert.equal(r.fitsSideways(0), false)
    assert.equal(r.fitsSideways(undefined), false)
    /*
     * The check on its side: a frame wider than the screen's short side (so
     * the phone is on its side) and under the line. The height is never
     * asked: the keyboard takes it, upright as well as on its side.
     */
    assert.equal(r.tooNarrow({ frame: { width: 700, height: 252 }, short: 360 }), true, 'a 780-point Galaxy with three buttons, on its side')
    assert.equal(r.tooNarrow({ frame: { width: 719.9, height: 300 }, short: 375 }), true)
    assert.equal(r.tooNarrow({ frame: { width: 720, height: 300 }, short: 360 }), false)
    assert.equal(r.tooNarrow({ frame: { width: 832, height: 332 }, short: 440 }), false)
    assert.equal(r.tooNarrow({ frame: { width: 832, height: 60 }, short: 440 }), false, 'the keyboard up on a big phone on its side is taken for a small phone')
    assert.equal(r.tooNarrow({ frame: { width: 440, height: 800 }, short: 440 }), false, 'a phone held upright is taken for one too narrow on its side')
    assert.equal(r.tooNarrow({ frame: { width: 360, height: 300 }, short: 360 }), false, 'a phone held upright with the keyboard up, its frame wider than tall, is taken for a small phone on its side')
    assert.equal(r.tooNarrow({ frame: { width: 393, height: 350 }, short: 393 }), false)
    /* Nothing measured, or no screen to measure it against: no. */
    assert.equal(r.tooNarrow({ frame: null, short: 393 }), false)
    assert.equal(r.tooNarrow({ frame: { width: 700, height: 252 } }), false)
    assert.equal(r.tooNarrow(), false)
  })

  test('phone turns: the phone is asked by name through the package’s native part, Android never for "unspecified", and a failure is a log line', async () => {
    const r = await rule()
    /* The iPhone: upright is PORTRAIT_UP (3), turning is DEFAULT (0: every way but upside down), and so is letting go. */
    const ios = phone()
    const onIos = await talker({ native: ios, os: 'ios' }, r)
    assert.equal(await onIos.askTurn(r.UPRIGHT), true)
    assert.equal(await onIos.askTurn(r.TURNS), true)
    assert.equal(await onIos.askTurn(r.RELEASE), true)
    assert.deepEqual(ios.asked, [
      ['lockAsync', 3],
      ['lockAsync', 0],
      ['lockAsync', 0]
    ])
    assert.deepEqual(onIos.finds, ['ExpoScreenOrientation'], 'the native part is looked for more than once, or by another name')
    /*
     * Android: turning is the phone's own choice ("user", 2), NEVER DEFAULT.
     * DEFAULT there is "unspecified", which plugins/withTabletTurns takes
     * for nothing asked: it would put the phone upright again the moment it
     * turned, which is the bug this build is for.
     */
    const android = phone()
    const onAndroid = await talker({ native: android, os: 'android' }, r)
    assert.equal(onAndroid.ANDROID_USER, 2, 'not ActivityInfo.SCREEN_ORIENTATION_USER')
    await onAndroid.askTurn(r.UPRIGHT)
    await onAndroid.askTurn(r.TURNS)
    await onAndroid.askTurn(r.RELEASE)
    assert.deepEqual(android.asked, [
      ['lockAsync', 3],
      ['lockPlatformAsync', 2],
      ['lockAsync', 0]
    ])
    /* Anything else is not asked at all. */
    assert.equal(await onAndroid.askTurn('sideways'), false)
    assert.equal(await onAndroid.askTurn(null), false)
    assert.equal(android.asked.length, 3)
    /* A copy built without the package: false, said once in the log, and nothing thrown, however often it is asked. */
    for (const missing of [{ native: null }, { native: {} }, { native: null, throwsOnFind: true }]) {
      const none = await talker(missing, r)
      assert.equal(await none.askTurn(r.UPRIGHT), false)
      assert.equal(await none.askTurn(r.TURNS), false)
      assert.equal(none.log.length, 1, 'a copy without the module says so at every ask, or not at all')
      assert.match(none.log[0].message, /no screen orientation module/)
      assert.equal(none.finds.length, 1)
    }
    /* A phone that refuses: false, a line that says what was asked and why, and nothing thrown. */
    const no = phone({ refuses: true })
    const refused = await talker({ native: no, os: 'ios' }, r)
    assert.equal(await refused.askTurn(r.TURNS), false)
    assert.equal(refused.log.length, 1)
    assert.match(refused.log[0].message, /would not take "turns"/)
    assert.equal(refused.log[0].detail, 'the phone said no')
    /* Never the package's own front door, which throws while the app loads if the native part is missing; and no bare number where the package has a name. */
    const src = code(read('mobile/src/lib/turnScreen.js'))
    assert.doesNotMatch(src, /from 'expo-screen-orientation'|require\(/)
    assert.doesNotMatch(src, /lockAsync\(\d/)
    /* The names are the installed package's own, wherever it is installed (a checkout without the phone's packages has nothing to read). */
    const types = 'mobile/node_modules/expo-screen-orientation/build/ScreenOrientation.types.js'
    if (there(types)) {
      const names = read(types)
      assert.match(names, /OrientationLock\[OrientationLock\["DEFAULT"\] = 0\]/)
      assert.match(names, /OrientationLock\[OrientationLock\["PORTRAIT_UP"\] = 3\]/)
    }
  })

  test('phone turns: the config lets an iPhone turn to either side and starts it upright, an iPad keeps its four ways, and the app applies the rule over every screen', async () => {
    const app = JSON.parse(read('mobile/app.json')).expo
    const pkg = JSON.parse(read('mobile/package.json'))
    assert.ok(pkg.dependencies['expo-screen-orientation'], 'the package is not installed')
    assert.equal(JSON.parse(read('mobile/package-lock.json')).packages['node_modules/expo-screen-orientation']?.version?.split('.')[0], pkg.dependencies.expo.replace(/^\D+/, '').split('.')[0], 'the package is not the one this Expo version wants')
    /* An iPhone: upright and either side, never upside down. Written out, so Expo's "default" (which lists upside down) is not what the iPhone gets. */
    assert.equal(app.orientation, 'default')
    assert.deepEqual(app.ios.infoPlist.UISupportedInterfaceOrientations, ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'])
    /* An iPad: Expo's own four, which it writes for a tablet-supporting app that does not ask for the whole screen; nothing here narrows them. */
    assert.equal(app.ios.supportsTablet, true)
    assert.equal(app.ios.requireFullScreen, undefined, 'an iPad that takes the whole screen can be locked, and loses Split View')
    assert.equal(app.ios.infoPlist['UISupportedInterfaceOrientations~ipad'], undefined)
    /* It starts upright (the startup card, the sign-in), before any of the app's own code runs; an iPad starts every way up. */
    const plugins = app.plugins.filter((p) => (Array.isArray(p) ? p[0] : p) === 'expo-screen-orientation')
    assert.deepEqual(plugins, [['expo-screen-orientation', { initialOrientation: 'PORTRAIT_UP' }]])
    assert.equal(app.ios.infoPlist['EXDefaultScreenOrientationMask~ipad'], 'UIInterfaceOrientationMaskAll')
    /* Android's part is the plugin's (test/duo.mjs runs it): still in, once. */
    assert.equal(app.plugins.filter((p) => p === './plugins/withTabletTurns').length, 1)

    /* App.js: mounted once, over every screen (outside the frame that picks one), and told exactly these things. */
    const main = read('mobile/App.js')
    const tree = flat(main)
    assert.match(main, /^import \{ PhoneTurns \} from '\.\/src\/components\/PhoneTurns'$/m)
    assert.equal(tree.split('<PhoneTurns ').length - 1, 1, 'the phone is told which way up from two places')
    assert.match(tree, /<SafeAreaProvider> \{ \} <PhoneTurns allowed=\{sidewaysAllowed\} inApp=\{turnsInApp\} onPlay=\{screen === 'stage'\} beside=\{sideTool !== null\} stageView=\{stageViewUp\} frame=\{frame\} \/>/, 'the rule is not over every screen, or is told something else')
    assert.match(tree, /const turnsInApp = auth === 'in' && seenWalk === true && !independentDue && !askHow && !askShare && !buying /, 'a page in front of the app can be turned')
    /* The same switch as the layout it turns for: his account until the switch opens it. */
    assert.match(tree, /const sidewaysAllowed = sidesAdmin \|\| \(sidesAllowed && PHONE_SIDEWAYS_FOR_EVERYONE\) /)

    /* The component: the whole screen (never the window) says tablet, the rule says what is wanted, and only a change is told. */
    const part = flat(read('mobile/src/components/PhoneTurns.js'))
    assert.match(part, /const tablet = isTablet\(\{ pad: Platform\.OS === 'ios' && Platform\.isPad === true, width, height \}\)/)
    assert.match(part, /Dimensions\.get\('screen'\)/)
    assert.match(part, /const wanted = turnsWanted\(\{ tablet, allowed, fits, inApp, onPlay, beside, stageView \}\)/)
    assert.match(part, /const step = turnStep\(asked\.current, wanted\) if \(!step\) return/)
    assert.match(part, /\}, \[wanted\]\)/)
    /* Across is worked out only while upright, and kept on its side. */
    assert.match(part, /if \(height > width\) \{ known\.current\.across = sidewaysAcross\(\{ os: Platform\.OS, width, height, top: insets\.top, bottom: insets\.bottom \}\) known\.current\.upright = true \}/)
    assert.match(part, /tooNarrow\(\{ frame, short: Math\.min\(width, height\) \}\)/, 'the frame is not measured against the screen’s short side, so the keyboard up could read as a small phone')
    /* Android alone is asked again when the app comes back to the front, and never on a tablet (the rule's null). */
    assert.match(part, /if \(Platform\.OS !== 'android'\) return undefined const sub = AppState\.addEventListener\('change', \(state\) => \{ const now = wants\.current if \(state !== 'active' \|\| \(now !== UPRIGHT && now !== TURNS\)\) return/)
    /* It draws nothing, and reaches the phone only through lib/turnScreen. */
    assert.match(part, /return null \} ?$/)
    assert.doesNotMatch(part, /expo-screen-orientation|requireOptionalNativeModule|<View|<Text/)
    /* And nothing else in the app turns the phone. */
    assert.deepEqual(
      ['mobile/App.js', 'mobile/src/screens/Stage.js', 'mobile/src/components/Sides.js', 'mobile/src/components/TopBar.js'].filter((f) => /askTurn|ExpoScreenOrientation/.test(read(f))),
      []
    )
  })
}
