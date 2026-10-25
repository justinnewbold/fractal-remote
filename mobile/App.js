/* First, so every sentence that names the device knows which one it is on. */
import './src/lib/thisDevice'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ActivityIndicator, Alert, AppState, Appearance, BackHandler, Linking, ScrollView, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

import { color, font, space, isDark, loadMode, setSystemDark, themeVersion, watchTheme } from './src/lib/theme'
import { SAFE_EDGES } from './src/lib/screenShape'
import { loadLooks, looksVersion, watchLooks } from './src/lib/looks'
import { haveSession, linkState, probeNow, startLink, stopLink, subscribeLink } from './src/lib/link'
import { currentAccount, signOut } from './src/lib/relay'
import { useComputerElsewhere } from './src/lib/useComputerElsewhere'
import { useNoComputer } from './src/lib/useNoComputer'
import { isPairAccount } from './src/lib/pairing'
import Note from './src/components/Note'
import Press from './src/components/Press'
import NoComputerWords from './src/components/NoComputer'
import SendLinkButton from './src/components/SendLinkButton'
import TopBar from './src/components/TopBar'
import WrongAccount from './src/components/WrongAccount'
import UpdateReady from './src/components/UpdateReady'
import { watchForUpdates } from './src/lib/updates'
import { watchStoreVersion } from './src/lib/storeVersion'
import DemoUnit from './src/components/DemoUnit'
import LiveUnit from './src/components/LiveUnit'
import MetronomeBeat from './src/components/MetronomeBeat'
import { useUnitMetronome } from './src/lib/metronome'
import Settings from './src/screens/Settings'
import EdgeBack from './src/components/EdgeBack'
import SignIn from './src/screens/SignIn'
import Onboarding from './src/screens/Onboarding'
import IndependentNotice, { independentNoticeSeen, markIndependentNotice } from './src/components/IndependentNotice'
import { NOT_AFFILIATED } from './src/lib/affiliation'
import { walkthroughSeen, markWalkthrough } from './src/lib/walkthrough'
import Edit from './src/screens/Edit'
import Connect from './src/screens/Connect'
import Fixes from './src/screens/Fixes'
import Gear from './src/screens/Gear'
import Log from './src/screens/Log'
import Report from './src/screens/Report'
import BluetoothReport from './src/screens/BluetoothReport'
import Presets from './src/screens/Presets'
import Setlists from './src/screens/Setlists'
import Stage from './src/screens/Stage'
import { hydrate, sync } from './src/lib/store'
import { keepSetlistsInStep } from './src/lib/cloudSetlists'
import { keepVp4SetupIn } from './src/lib/device'
import { clearLinkFault, useRig } from './src/lib/rig'
import { keepLog } from './src/lib/logKeep'
import { installCrashCapture } from './src/lib/debugLog'
import { restoreDemo, setDemo, useDemo } from './src/lib/demo'
import {
  ALLOW_WORDS,
  APPLE_SCREEN_OPENS,
  RESTRICTED_WORDS,
  allowBluetooth,
  lookForAdapterAgain,
  offeredAm4Only,
  opensApplesScreen,
  restoreBluetooth,
  setBluetooth,
  useBluetoothOn,
  useBluetoothTrouble
} from './src/lib/bluetooth'
import { useBluetoothOffered } from './src/lib/useBluetoothOffered'
import { BLUETOOTH_WAYS_SHORT, BLUETOOTH_WAYS_SHORT_AM4, REPORT_BUTTON } from './src/lib/bluetooth-gear'
import { overBluetooth } from './src/lib/bleSwitch'
import { BENCH } from './src/lib/features'
import Paywall from './src/screens/Paywall'
import { checkOwner, linkAccount, linkNewAccount, poseAsNewCustomer, startPurchases, unlinkAccount, usePurchase } from './src/lib/purchases'
import { shouldAskToPay } from './src/lib/unlock-rule'
import { deviceNoun } from './src/lib/device-word'
import { allowSiriLinks, siriElsewhere, startSiri } from './src/lib/siri'
import { playElsewhereOf } from './src/lib/siri-rule'
import { logFoldChanges } from './src/lib/foldSensor'

/* The VP4's Scene Select number and MIDI channel live in the phone's store; the device layer reads them from there (lib/vp4-safety). */
keepVp4SetupIn(sync)

/**
 * Fractal Remote.
 *
 * A handful of states and no navigator. Signed out, playing, looking at the
 * preset list, fixing the running order, fixing a chain, or looking at setup —
 * that is the whole of the app, and a routing library for it would be more
 * moving parts than the thing being routed.
 *
 * The status bar at the top is the one thing on every screen: what the link is
 * doing, said in words rather than an icon, because "connected" and "connected
 * to a Mac that stopped answering four minutes ago" look identical as a dot.
 */
export default function App() {
  /*
   * Light, dark, or whatever the phone is set to.
   *
   * "I'm not seeing where the light/dark/auto theme buttons are anymore.
   * Please put that back on Setup." The browser has had all three for a long
   * time; the phone had none and was dark whatever the handset was set to.
   *
   * Subscribed HERE, at the root, and nowhere else. lib/theme swaps the values
   * on the one exported `color` object rather than handing out a new one, so
   * every screen's inline styles pick the new palette up on their next render
   * — and one re-render at the top is every screen's next render. See the note
   * on `color` for why that works and what it depends on.
   */
  useSyncExternalStore(watchTheme, themeVersion, themeVersion)
  /*
   * And the colours, by the same trick and for the same reason. A look picked
   * in Settings, a colour of your own, or a unit with its own palette
   * answering — every tile on every screen reads blockColor and sceneColor
   * while it renders, so one re-render here repaints them all. See lib/looks.
   */
  useSyncExternalStore(watchLooks, looksVersion, looksVersion)
  useEffect(() => {
    setSystemDark(Appearance.getColorScheme() !== 'light')
    const off = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemDark(colorScheme !== 'light')
    })
    return () => off?.remove?.()
  }, [])

  /** 'checking' | 'out' | 'in' */
  const [auth, setAuth] = useState('checking')
  /*
   * Whether the walkthrough has been through on this phone. Read once, so a
   * re-render cannot put somebody back at the start of it.
   *
   * NULL UNTIL STORAGE ANSWERS, rather than a guess either way.
   *
   * It used to start `true` — "assume seen" — because the alternative puts a
   * returning player at the start of a first-run flow for a frame. But that
   * is a guess, and the guess is wrong for everybody on their first launch:
   * the two reads that decide the opening screen race each other, and if the
   * session check lands first, a brand-new install draws the SIGN-IN screen
   * for a moment before the walkthrough replaces it.
   *
   * There is a third answer — not knowing — and the spinner below already
   * exists for exactly that. Both reads are a fraction of a second, and one
   * spinner is honest where either guess is a screen somebody saw and did
   * not ask for.
   */
  const [seenWalk, setSeenWalk] = useState(null)
  /*
   * Whether the walkthrough is up because somebody ASKED to see it again.
   *
   * A first run and a replay draw the same screens and mean opposite things.
   * On a first run every button is the next step; on a replay the person is
   * already set up and every one of them is wrong, so the replay gets a way
   * out that changes nothing.
   */
  const [replaying, setReplaying] = useState(false)
  /*
   * WHETHER THE STARTUP CARD IS STILL OWED: "An independent app", Fractal
   * Audio's sentence and where help comes from, once on every install
   * (components/IndependentNotice). Read with the walkthrough's answer and
   * set in the same moment, so the spinner covers both and nothing is drawn
   * on a guess: the card is decided before the walkthrough, the sign-in or
   * Play can be, and so it is never laid over any of them.
   */
  const [independentDue, setIndependentDue] = useState(false)
  useEffect(() => {
    /* A first run is told where Match my unit is too, on Play after the walkthrough (components/ColoursNotice): nothing is marked here for it. */
    Promise.all([walkthroughSeen(), independentNoticeSeen()]).then(([seen, noticed]) => {
      setIndependentDue(!noticed)
      setSeenWalk(seen)
    })
  }, [])
  const [screen, setScreen] = useState('stage')
  /*
   * WHICH PAGE OF SETTINGS, because Settings has pages inside it and the
   * app could only ever open it at the top.
   *
   * "This screen is supposed to pull up when you tap the unit name in the
   * top left of the screen, and it works fine on one platform, then not the
   * other." The browser opened Phone & computer from the unit name; the
   * phone opened the Settings list and left the last step to the thumb. Now
   * the name opens the page, the wrong-account warning opens it too, and
   * Settings reports the page it is on, so coming back from a screen it
   * opened (Connect a computer, the reference sheet) lands where you were.
   * The gear always opens the list. `visit` makes a fresh open start fresh
   * even when Settings is already on screen.
   */
  const [settingsAt, setSettingsAt] = useState(null)
  const [settingsVisit, setSettingsVisit] = useState(0)
  /* Where Amp & pedal names goes back to: Settings, or Edit, whichever opened it. */
  const [gearBack, setGearBack] = useState('settings')
  const openSettings = (at = null) => {
    setSettingsAt(at)
    setSettingsVisit((n) => n + 1)
    setScreen('settings')
  }
  /* Which fix the guide opens on, and which screen Done goes back to. */
  const [fixOpen, setFixOpen] = useState(null)
  const [fixFrom, setFixFrom] = useState('settings')
  /* Troubleshooting, open on the fix for a link that will not come up, and
     Done comes back to the stage. */
  const openConnectFix = () => {
    setFixOpen('connect')
    setFixFrom('stage')
    setScreen('fixes')
  }
  /* Where Done goes back to, for the same reason `fixFrom` exists. Only Setup
     opens the form today (the log sends its own report now, see Log.js), but
     a second way in should not have to remember to add this back. */
  const [reportFrom, setReportFrom] = useState('settings')
  /*
   * AND WHICH REPORT. Null is the Feedback form, as it always was;
   * 'bluetooth' is Report a Bluetooth problem (screens/BluetoothReport), the
   * one-tap report Bluetooth's own places open, with the words that were on
   * screen when it was opened (`reportSaid`, a fault line), which go with it.
   * One screen, 'report', so the way back is the one reportFrom it always
   * was, for Done, the swipe and Android's back alike.
   */
  const [reportAbout, setReportAbout] = useState(null)
  const [reportSaid, setReportSaid] = useState(null)
  const openReport = (from, about = null, said = null) => {
    /* Never back to itself: a report opened from over a report goes back where that one would have. */
    if (from !== 'report') setReportFrom(from)
    setReportAbout(about)
    setReportSaid(typeof said === 'string' && said.trim() ? said.trim() : null)
    setScreen('report')
  }
  const [link, setLink] = useState(linkState())

  /*
   * Where a left-edge swipe goes from the screen you are on.
   *
   * The same targets the Done buttons already use, named in one place so the
   * gesture and the button cannot drift into disagreeing. Two of them are not
   * constants — the guide is reached from Setup AND from the stage, and the
   * feedback form keeps its own way back (reportFrom) for the same reason.
   *
   * Nothing for `stage`: it is the bottom of the stack. Nothing for
   * `settings` either — it wraps itself, because it is the one screen with
   * pages inside it and only it knows whether back means its own list or the
   * way out.
   */
  const BACK_TO = {
    presets: 'stage',
    setlists: 'stage',
    edit: 'stage',
    connect: 'settings',
    gear: 'settings',
    log: 'settings',
    report: reportFrom,
    fixes: fixFrom
  }
  const backFrom = BACK_TO[screen] ? () => setScreen(BACK_TO[screen]) : null

  /*
   * ANDROID'S BACK BUTTON, AND ITS BACK GESTURE.
   *
   * "When pressing Android back button on every screen that has a Done
   * button, it exits the app. Maybe it would be advantageous to close that
   * window and go back to the previous screen." Nothing was listening, so
   * Android did its default, which is to close the app.
   *
   * Now it goes one step back, the same place the swipe from the edge goes,
   * or to Play from a screen with only Done. Settings and the amp and pedal
   * page listen for themselves first, because they have pages inside them.
   *
   * On Play itself, in the demo: "have a little pop-up that says Exit demo?
   * If yes, same action as the exit demo button." Only for somebody who has
   * the Exit demo button, which is somebody who has paid. Everywhere else on
   * Play, back does what Android always does and leaves the app.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (buying) {
        setBuying(false)
        return true
      }
      if (auth !== 'in') return false
      if (screen !== 'stage') {
        setScreen(BACK_TO[screen] || 'stage')
        return true
      }
      if (demo && purchase.unlocked) {
        Alert.alert('Exit demo?', 'Back to your own rig.', [
          { text: 'Stay', style: 'cancel' },
          { text: 'Exit demo', onPress: () => setDemo(false) }
        ])
        return true
      }
      return false
    })
    return () => sub.remove()
  })
  /** The last "picked up 2 setlists from your Mac", until it has been read. */
  const [picked, setPicked] = useState(null)
  /** Whether the five units are up, from the name in the corner. */
  const [pickUnit, setPickUnit] = useState(false)
  /* The same, for real units: only when more than one computer answers. */
  const [pickLive, setPickLive] = useState(false)

  /*
   * Whether there is a rig to draw yet.
   *
   * "This is the screen that pops up for about 5 seconds after force closing
   * and reopening the app. Maybe we need a splash screen while it's loading?"
   *
   * What he was looking at was the play screen with nothing in it: SLOT —,
   * Untitled, eight blank scene tiles, an empty chain, Previous and Next both
   * dead. Not a bug — every one of those is the honest answer to a question
   * nobody has got an answer to yet — but it reads as a rig that has lost
   * everything, which is a bad five seconds to hand somebody who is plugging in
   * before a set.
   *
   * So the screen is not drawn until there is something to draw. `capabilities`
   * is the first thing the unit answers with and the thing every other answer's
   * shape depends on, which makes it the honest gate: before it, this app knows
   * nothing about the rig at all.
   *
   * A READ THAT FAILS ENDS IT, because a failure is a thing worth showing
   * rather than waiting through: the play screen comes up with the error on
   * it, and the top bar and the gear are a tap away.
   *
   * A COMPUTER THAT NEVER ANSWERS DOES NOT. It used to: the wait ended when
   * the link stopped saying 'joining', and the play screen came up empty with
   * DISCONNECTED in the corner. "App keeps jumping back-and-forth from this
   * page every few seconds instead of offering suggestions on what to check"
   * (12 October 2026, his computer asleep). Every join passes through
   * 'no-answer' before the computer has had a chance to answer, and a relay
   * channel that drops a few seconds after each join turns that into a flip
   * every six and a half seconds — and each flip took the waiting screen
   * away, with its fifteen-second clock, before the advice could show. So the
   * wait now holds through 'joining' and 'no-answer' alike, and what bounds it
   * is that advice, on a clock that lives up here (useLookedLong, below).
   */
  /*
   * The demo, picked up before anything decides whether to ask for a sign-in.
   *
   * Somebody who was in the demo a second ago has no account and does not want
   * one; asking them to sign in on the way back would be the app forgetting
   * what it was doing.
   */
  const demo = useDemo()
  /*
   * And whether the phone talks to the unit itself, through a Bluetooth MIDI
   * adapter, rather than through the computer. Off unless somebody turned it
   * on in Settings → Bluetooth (beta); see lib/bluetooth.
   * Only the on-or-off, so the page's own goings-on do not redraw the app.
   */
  const bluetooth = useBluetoothOn()

  /*
   * And whether this person has paid to point the app at a real unit.
   *
   * The demo above is the free half of the same question, which is why the two
   * are read together: `demo` says nothing is being driven, `purchase` says
   * whether anything MAY be. Neither is allowed to be a guess — see the effect
   * further down, which is the only thing that raises the paywall.
   */
  const purchase = usePurchase()
  /*
   * THE WAY TO THE BLUETOOTH PAGE FROM THE WAITING SCREEN, through the same
   * gate as the Settings row and the page itself (lib/useBluetoothOffered,
   * the row's gate as one hook): the full version as Bluetooth reads it
   * (unlock-rule mayDriveBluetooth: the purchase itself for a customer),
   * Bluetooth open to this account on this copy (lib/bluetooth
   * useBluetoothAllowed: his on every copy, a customer's only on a copy
   * whose built-in store version opens it), and a build and a device that
   * can do it. Without all three the page draws nothing, so a button to it
   * would open an empty Settings page. Named once, so the waiting screen
   * gets the way in or nothing (`onBluetooth`).
   */
  const bluetoothOffered = useBluetoothOffered()
  /*
   * REPORT A BLUETOOTH PROBLEM, from wherever one is met: the Bluetooth page,
   * the note under Play's pill, a fault on Play while over Bluetooth, and the
   * waiting screen while it looks for the adapter. Through the same gate as
   * the page (`bluetoothOffered`), so a button that opens it is handed to
   * nobody the page is not drawn for; null otherwise, and the button is not
   * drawn. `from` is where Done comes back to.
   */
  const reportBluetooth = bluetoothOffered ? (from, said = null) => openReport(from, 'bluetooth', said) : null
  /*
   * ASKED FOR, as opposed to imposed.
   *
   * `auth === 'paywall'` is the gate: somebody with a real rig who has not
   * paid, stopped on the way in. This is the other direction — somebody in
   * the DEMO who has decided they want the thing, or anybody looking for the
   * purchase they already made. It opens over whatever is on screen and closes
   * back to it, because nothing is being withheld: they came looking.
   */
  const [buying, setBuying] = useState(false)

  /*
   * THE WAY BACK TO AN ACCOUNT, FROM ANYWHERE INSIDE THE APP.
   *
   * "I am logged in and it shows this screen and says I still need to unlock.
   * There is no way to login with user name and password after you are in the
   * app on the demo."
   *
   * Both halves of that were true. The demo is a session-less state, so the
   * unlock it is offered is the right one for somebody with no account — and
   * there was no way from there to say "I have one". Setup offered Sign out
   * and nothing else, which is no use to somebody with nothing to sign out of.
   *
   * IT DOES NOT SIGN ANYTHING OUT ON THE WAY. A phone paired by code has a
   * real session, and throwing it away to show a form somebody might back out
   * of would cost them their pairing for nothing. Signing in replaces the
   * session; backing out leaves it exactly as it was, and the demo button on
   * that screen is the way back in.
   *
   * The demo ends here, though: somebody heading for an account is heading for
   * a real rig, and the simulated unit would otherwise still be answering.
   */
  const toSignIn = () => {
    setBuying(false)
    setScreen('stage')
    setDemo(false)
    /* Heading for the sign-in form is a sign-out for Bluetooth (beta): off, and written down (lib/bluetooth). */
    allowBluetooth(null, { signedOut: true })
    setAuth('out')
  }
  /*
   * AND WHICH SIDE OF THE FORM IT OPENS ON: Sign in, unless something said
   * otherwise. Create account straight after a purchase with nobody signed
   * in (purchases.js, boughtAlone), and from "Make an account", the door
   * for a phone whose purchase is on no account yet (onlyHere) — its lines
   * on the demo's stage and in Settings → Account. Only for the form it
   * opened: leaving it, any way, puts it back to Sign in, so a later "Sign
   * in" never opens on "now make your account" for somebody who has made
   * one, or has walked away from making one.
   */
  const [signInSide, setSignInSide] = useState('in')
  useEffect(() => {
    if (purchase.boughtAlone) setSignInSide('up')
  }, [purchase.boughtAlone])
  useEffect(() => {
    if (auth !== 'out') setSignInSide('in')
  }, [auth])
  const toMakeAccount = () => {
    toSignIn()
    setSignInSide('up')
  }
  /*
   * THE TOUR, WHICH THIS END NEVER HAD. "First issue is demo has no
   * tutorial. Very important."
   *
   * Starts hidden and appears only once disk has answered, so somebody who
   * read it last week never sees it flash. It waits for the app to be past
   * the door — there is nothing to tour from a sign-in screen, and a tutorial
   * arriving on top of a real problem is noise over the one message that
   * mattered.
   */

  const caps = useRig(ofCaps)
  const readFailed = useRig(ofError)
  /* The metronome: the unit in front of us is told whenever it changes, and
     the phone keeps time at its tempo. See lib/metronome. */
  const rigSlug = useRig((s) => s.deviceSlug)
  const rigBpm = useRig((s) => s.bpm)
  const unitHere = useRig((s) => s.unit === 'present')
  useUnitMetronome(rigSlug, unitHere && !demo, { bluetooth })
  /*
   * Out looking and not yet answered: the computer (over Bluetooth (beta),
   * the adapter). 'joining' and 'no-answer' are one stretch of looking, not
   * two. A relay channel that drops a few seconds after every join swaps
   * between them every six and a half seconds while the computer stays
   * silent (his log, 12 October 2026), and nothing on screen may follow it.
   */
  const looking = link.link === 'joining' || link.link === 'no-answer'
  /*
   * ONLY WHILE THERE IS NO RIG (`!caps`), over the computer. Before this, a
   * link that went to 'joining' put the waiting screen over a rig already on
   * screen, mid-song: the scenes, the pedals and Tap swapped out for a
   * spinner, and back, at every drop — every return from sleep on Android
   * among them. Once the unit has said what it is, the play screen stays, the
   * top bar says the link is down, and after fifteen seconds the advice
   * floats over it (`lost`, on Stage below).
   *
   * OVER BLUETOOTH (BETA) A LOST ADAPTER STILL BRINGS IT BACK, rig or no rig,
   * as it always has. Its link does not flip — it says 'joining' until the
   * adapter is there again — and the waiting screen is where its own help
   * is: "Use the computer instead" from the first second, then what to check
   * on the phone and the adapter, Look for the adapter again and the
   * Bluetooth (beta) page. The card over the play screen has none of that.
   */
  const settling = auth === 'in' && !demo && ((looking && (!caps || bluetooth)) || (link.link === 'connected' && !caps && !readFailed))
  /* The play screen itself is up: not the waiting screen standing in for it. */
  const playOnScreen = screen === 'stage' && !settling
  /*
   * AND ANOTHER SCREEN IS UP IN ITS PLACE, for Siri (lib/siri): a command
   * said there is answered with "Open Play" at once, while one said as the
   * app is still starting waits for Play inside its tap rule. The startup
   * card, the walkthrough, the sign-in and the paywall are elsewhere too:
   * Play does not come by itself from any of them (lib/siri-rule
   * playElsewhereOf says which is which).
   */
  const playElsewhere = playElsewhereOf({ auth, seenWalk, independentDue, screen })
  useEffect(() => siriElsewhere(playElsewhere), [playElsewhere])
  /*
   * And the new-version note only floats over it while the phone is off the
   * rig. Over a connected rig a download can land mid-song, and the note's
   * Restart now would come up where the preset button is, under a thumb on
   * its way to it. There it waits: the app takes the version by itself after
   * a break (lib/update-rule.js), and Settings offers the restart meanwhile.
   */
  const readyOverPlay = playOnScreen && link.link !== 'connected'
  /*
   * THE FIFTEEN SECONDS, counted from when this stretch of looking began —
   * not from the last change of link.link, which during the flip was never
   * more than five seconds ago. A stretch ends when the computer answers, or
   * on signing out or going into the demo (the first argument), and a new
   * one starts when Bluetooth goes on or off (the second).
   *
   * NOT AGAIN at Look for the computer again. That took the advice and its
   * Troubleshooting away for fifteen seconds after a tap that, with the
   * computer still asleep, changed nothing: the help he was reading gone,
   * and back only if he stood there long enough. The button asks at once
   * (probeNow), and if the computer answers the advice goes because the
   * looking is over.
   */
  const lookedLong = useLookedLong(auth === 'in' && !demo && looking, bluetooth ? 'adapter' : 'computer')
  /*
   * And put away with its ✕ on the play screen until the computer has
   * answered again. Kept up here, with the clock, rather than in Stage: a
   * look at Setlists or Settings takes Stage off the screen, and the card
   * came straight back with it.
   */
  const [lostAway, setLostAway] = useState(false)
  useEffect(() => {
    if (!lookedLong) setLostAway(false)
  }, [lookedLong])
  /*
   * AND WHETHER THERE IS A COMPUTER TO FIND AT ALL. "Clearer help for new
   * customers. 'No computer is signed in with this account yet, here's the
   * download' instead of 'make sure it's awake.'" (13 October 2026) About
   * twelve of the first forty paid accounts had never signed in on a
   * computer, and the advice that comes up at fifteen seconds told them to
   * wake one.
   *
   * Asked at that same moment and no sooner, at most once a minute, and not
   * again once the answer has been yes (lib/useNoComputer.js). Never over
   * Bluetooth (beta), where no computer is being looked for; never in the
   * demo or signed out, which `lookedLong` already leaves out. Anything but
   * a definite no is null, and the screens keep today's words.
   */
  const noComputer = useNoComputer(lookedLong && !bluetooth)
  /*
   * THE LINK AS THE TOP BAR AND SETUP SAY IT. The flip under the waiting
   * screen was in the corner too: amber CONNECTING for a second and a half,
   * red DISCONNECTED for five, for minutes, with Try now coming and going
   * under it, and read out again each time to anybody using TalkBack or
   * VoiceOver. Once this stretch of looking has gone unanswered it stays
   * unanswered until the computer is back (useHeldLink, below).
   */
  const shownLink = useHeldLink(link, looking, bluetooth ? 'adapter' : 'computer')
  /*
   * Where the pill on the bar goes, named once, so the tap and what a screen
   * reader says it does cannot disagree (TopBar unitGoes). Which unit only
   * while the link is up: over a link that is down its rows switch to
   * computers nobody can reach, and Phone & computer has Look for the
   * computer again, the retry the word DISCONNECTED used to open.
   */
  const unitGoes = demo ? 'demo' : link.hosts?.length > 1 && link.link === 'connected' ? 'which' : 'link'
  /* Whether the stage is already saying the computer is on another account
     (WrongAccount): then "make sure the computer is awake" would be the wrong
     advice, and Waking keeps the same order. */
  const [elsewhereSaid, setElsewhereSaid] = useState(false)

  /*
   * THE BAR AND THE RED NOTE, TOLD THE SAME NEWS.
   *
   * "Says I'm not connected to the computer, but it also says I'm connected."
   *
   * Both were drawn from the truth at the time, and only one of them was kept
   * up to date. At launch the relay has not joined, the first read throws
   * "Not connected to your computer.", and the note says so — correctly. A
   * second later the channel joins, the bar turns green, the chain arrives,
   * and the note is still underneath it saying the opposite, with a "what to
   * try" button under THAT.
   *
   * refreshAll already cleared the note when a detect SUCCEEDED, which is why
   * this looked fixed. It is not the same moment: the note he photographed
   * was set by a read that failed just after one had worked, while the relay
   * was still coming up. The link arriving is the other half of that
   * evidence, and this is the only place that hears it.
   *
   * Only a complaint ABOUT the link goes; see rig.clearLinkFault. A unit that
   * refused a write is still worth reading after a reconnect.
   */
  useEffect(
    () =>
      subscribeLink((next) => {
        setLink(next)
        clearLinkFault(next.link)
      }),
    []
  )

  /*
   * Setlists and stars, off disk and into memory, once.
   *
   * They are read while a screen renders — what Previous and Next step through
   * is decided during the stage screen's draw — and AsyncStorage cannot be read
   * that way. So the waiting happens here, at launch, and every read after it is
   * immediate. Nothing waits on it: a store that has not landed yet reads as
   * "nothing saved", which is what a fresh install is anyway, and the screens
   * re-draw when it does. See lib/store.
   */
  useEffect(() => {
    /* And the theme, from the same store, as soon as it has landed. Before
       that it is Auto, which follows the handset — the right answer to show
       somebody on their first launch anyway. */
    hydrate().then(() => loadMode(sync))
    /* The colours too, from the same store. Until they land, the look and the
       last unit's palette are not known yet, and the default look, Fractal
       Remote, is what is drawn — for a moment, as the theme is Auto. */
    hydrate().then(() => loadLooks(sync))
  }, [])

  /* Ask the store what this person owns. Never throws, never blocks a frame,
     and answers "not locked" to anything it cannot find out. */
  useEffect(() => {
    startPurchases()
  }, [])

  /*
   * THE DEMO IS NOT AN ACCOUNT, AND WHEN IT ENDS THE APP HAS TO ADMIT THAT.
   *
   * "Right now I'm not signed in and it's still letting me use it... the user
   * should be required to either sign in if they already have a sign in or
   * sign up right after they unlock it and they shouldn't be able to get past
   * that screen."
   *
   * He is right, and the hole is mine. `auth` goes to 'in' on startup if the
   * demo is on OR a session is found — the demo needs no account, which is
   * the whole point of it. That was honest while the only way out of the demo
   * was a button nobody pressed by accident. Then 1.56.0 made a purchase end
   * the demo, which is correct, and left 'in' standing behind it: the live
   * app, unlocked, signed in to nothing, reaching nothing, with no sign of
   * anything wrong.
   *
   * So 'in' has to keep meaning what it meant. Whenever the demo goes off,
   * the session is asked for again, and a phone that has not got one goes to
   * the sign-in screen — which is also where the purchase gets claimed, since
   * SignIn's onSignedIn calls linkAccount.
   *
   * On the demo ending rather than on the purchase, deliberately: leaving by
   * the Exit demo button has the same gap, and a check on the state cannot be
   * forgotten by a route added later.
   *
   * Nobody is stranded. The sign-in screen signs in, makes an account, resets
   * a password, and still offers the demo.
   */
  useEffect(() => {
    if (demo || auth !== 'in') return undefined
    let alive = true
    haveSession()
      .then((id) => alive && !id && setAuth('out'))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [demo, auth])

  /*
   * THE ONE PLACE THE PAYWALL IS RAISED, and it waits to be sure.
   *
   * Both ways in land on `auth === 'in'` — a code typed just now, and a
   * session left over from last time — so gating either one of them at the
   * door would have meant gating both, in two places, differently. This is
   * after the door instead: whatever let somebody in, the question of whether
   * they may drive a REAL unit is asked here and only here.
   *
   * Every one of the four conditions below is a reason NOT to charge, and
   * three of them are reasons not to be certain:
   *
   *   demo               — free for ever, and the whole point of the free half
   *   purchase.checking  — no answer yet; an unanswered question is not a "no"
   *   !purchase.available— no module, no key, or the store is unreachable
   *   purchase.unlocked  — they paid
   *
   * Which means a cold start on a dead network shows the app, not a paywall.
   * That is deliberate and it is the rule the purchase module is built around:
   * the people most likely to be on bad wifi are the ones standing on a stage,
   * and an app that locks itself there is worse than one that occasionally
   * lets an unpaid launch through.
   */
  useEffect(() => {
    if (shouldAskToPay({ inApp: auth === 'in', demo, ...purchase })) setAuth('paywall')
  }, [auth, demo, purchase.checking, purchase.available, purchase.unlocked])

  /*
   * Keep the end of this run on disk from the first frame.
   *
   * "It crashes within a few minutes and is virtually unusable. I can't get to
   * the log before it crashes." A log that only lives in memory is a log you
   * cannot read about the run that ended — which is every run worth reading.
   */
  useEffect(() => keepLog(), [])

  /*
   * And tell that log when the app falls over.
   *
   * Every crash so far has left a log that ends mid-evening with nothing
   * wrong in it — because the browser installs this and the phone never did.
   * An uncaught error on a phone goes to React Native's own handler, which
   * ends the app in silence; from here it writes a line first, with the
   * message and where it came from, and the line is on disk before the app
   * goes. See installCrashCapture in lib/debugLog.
   */
  useEffect(() => installCrashCapture(), [])

  /* Ask about updates in the background, offer a downloaded one as a
     restart, and take it by itself only on coming back after two hours off
     the rig — see watchForUpdates, lib/update-rule and components/UpdateReady. */
  useEffect(() => watchForUpdates(), [])

  /* And whether the copy on this phone is older than the store's, asked of
     the website at most once a day — see lib/storeVersion. */
  useEffect(() => watchStoreVersion(), [])

  /*
   * SIRI, for the life of the app and not only Play's: Tuner off works from
   * any screen, and any other command said off Play is answered with where
   * to go. Nothing at all on a build without the Siri phrases. See lib/siri.
   */
  useEffect(() => startSiri(), [])

  /*
   * THE FOLD SENSOR, written to the debug log and nothing else: on an iPhone
   * Duo, a line each time the hinge, the fold or the window changes shape.
   * Nothing on screen reads it yet. Nothing at all on Android, in the browser
   * or on a build without it. See lib/foldSensor.
   */
  useEffect(() => logFoldChanges(), [])

  /* Bluetooth (beta), picked up from last time. First, so that a phone left
     on Bluetooth starts on Bluetooth; one read of the phone's own storage. */
  useEffect(() => {
    restoreBluetooth()
  }, [])

  // A session left over from last time is the ordinary case: a phone that
  // signed in once is a remote, and it should say "Connecting…" from its first
  // frame rather than showing a sign-in form for the second it takes to find
  // out otherwise.
  /*
   * AND ONE THAT RAN OUT WITH NO SIGNAL TO RENEW IT IS STILL LEFT OVER.
   * "A customer at a gig with no phone signal can be locked out of the whole
   * app, Bluetooth included." It was: the renewal got no answer, the session
   * read as none, and this drew the sign-in screen in front of somebody who
   * had paid, on Bluetooth with no computer, with no internet to sign in
   * over. haveSession now says whose sign-in is still on the phone when the
   * only thing wrong is that the account service could not be reached
   * (relay.js keptSession), and the purchase it last knew comes off the
   * phone as well (purchases.js, remembered). One the account service turned
   * away, a sign-out somebody asked for and a deleted account are not on the
   * phone any more, and still open on the sign-in screen.
   */
  useEffect(() => {
    let alive = true
    restoreDemo()
      .then((on) => (on ? true : haveSession()))
      .then((id) => {
        if (!alive) return
        /*
         * WHOSE PHONE THIS IS, FOR BLUETOOTH (BETA), SETTLED BEFORE THE DOOR
         * OPENS. The pick-up from last time, above, can already have put the
         * phone back on Bluetooth, and 'in' starts the link in the same
         * moment it is set. Asked here, a customer's phone left on Bluetooth
         * is back on the computer before the link starts, rather than
         * reaching for the adapter at launch and letting go of it a beat
         * later. Not in the demo (`true`): the effect below asks once the
         * demo has let the app in, and the demo plays its simulated unit
         * whatever this says (lib/link.js puts the demo first).
         */
        if (id !== true) allowBluetooth(id)
        setAuth(id ? 'in' : 'out')
      })
      .catch(() => alive && setAuth('out'))
    return () => {
      alive = false
    }
  }, [])

  /*
   * AND BLUETOOTH (BETA) ONLY WHERE IT IS OPEN, at every change of who is
   * signed in.
   *
   * "Is there any way to just get the Bluetooth on the developers mode for my
   * own phone? I just feel like it's not ready to have public." Settings
   * draws the row and the page only where it is open (useBluetoothAllowed):
   * his account on every copy, and a customer's only on a copy whose
   * built-in store version opens it (lib/ble-rule.js), which no copy today
   * does; this is the switch's half. Signed out, signed into an account it is
   * not open to, or a customer who turned it on during the day it was
   * public: back to the computer, and allowBluetooth keeps it from being
   * turned on again (lib/bluetooth). The copy decides it, never this
   * effect: an update can change what runs here, and not the number built
   * into the copy.
   *
   * THE SESSION KEPT ON THE PHONE, not the account server. Bluetooth is for
   * playing with no computer, often somewhere with no signal either, and
   * currentAccount() asks the server: with no signal it answers nobody, and
   * his own Bluetooth would be switched off at the gig. haveSession() reads
   * the same session that let this phone in, and says yes for as long as the
   * phone is still let in at all — a sign-in that has run out with no signal
   * to renew it included, which now lets the phone in (see the launch,
   * above).
   *
   * Signed out is nobody, at once, without asking anything: a sign-out still
   * finishing in the background cannot answer for the account it is
   * removing.
   *
   * AND NOBODY IS NOT A NO. Here it only means no session on the phone —
   * since keptSession, a sign-in that ran out at a gig with no signal answers
   * with its id, so what is left is a sign-in the account service turned
   * away, or a phone that could not read its own — and neither is his
   * saying no: Bluetooth goes off for now, and the phone's storage keeps it
   * on for the next launch that knows it is his. The
   * sign-outs somebody asked for — Sign out and Delete account in Settings,
   * the paywall's back, Try the Demo and Delete account, and the way to the
   * sign-in form (toSignIn) — say so themselves, with `signedOut`, and those
   * write the off down.
   */
  useEffect(() => {
    if (auth === 'checking') return undefined
    if (auth === 'out') {
      allowBluetooth(null)
      return undefined
    }
    let alive = true
    haveSession()
      .then((id) => alive && allowBluetooth(id))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [auth, demo])

  /*
   * AND THE fractalremote:// LINKS (lib/siri), BY THE SAME SESSION KEPT ON
   * THE PHONE: Justin's alone on a copy of the app from before them, and
   * everybody's on the new store version, which lib/siri tells from the copy
   * itself. Asked at every change of who is signed in, as Bluetooth (beta)
   * is; a link that started the app waits for this answer.
   */
  useEffect(() => {
    if (auth === 'checking') return undefined
    if (auth === 'out') {
      allowSiriLinks(null)
      return undefined
    }
    let alive = true
    haveSession()
      .then((id) => alive && allowSiriLinks(id))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [auth, demo])

  /*
   * THE LINK, AND IT HAS TO WATCH THE DEMO TOO.
   *
   * "This says I'm connected to an AM4 which I have not connected to in
   * weeks. I exited the demo and that's what it shows."
   *
   * It did. Leaving the demo left the whole screen dressed as a live rig: the
   * AM4's name in the bar, its 104 slots, its four scenes, its chain, and
   * CONNECTED in green beside them.
   *
   * WHY. startLink() short-circuits in the demo — there is no far end to poll,
   * so it sets `link: 'connected', macName: 'the demo'` and returns. Correct
   * while the demo is on; the bar says DEMO rather than CONNECTED because
   * TopBar asks the demo store, not the link.
   *
   * But this effect depended on `auth` alone. Turning the demo off does not
   * touch `auth` — Settings' "Leave the demo" calls setDemo(false) and nothing
   * else — so the effect never re-ran, stopLink() never happened, and that
   * made-up 'connected' stayed. The word in the bar changed from DEMO to
   * CONNECTED the moment `demo` went false, and every number under it was
   * still the simulation's.
   *
   * Depending on `demo` as well is the whole fix: the cleanup runs stopLink(),
   * which resets the rig store and the link state, and startLink() then does
   * the real work with the demo off. It is right in the other direction too —
   * entering the demo now clears a real rig's presets instead of leaving them
   * under a simulated unit's name.
   *
   * remoteDisconnect() drops the channel, not the account, so the session is
   * still there to rejoin with.
   *
   * AND BLUETOOTH (BETA), for the same reason as the demo. Turning it on or
   * off touches neither `auth` nor `demo`, and the link has to start again
   * the other way: stopLink lets go of whichever it was using and clears the
   * rig, and startLink then connects to the adapter or to the computer.
   */
  useEffect(() => {
    if (auth !== 'in') return undefined
    startLink()
    return () => {
      stopLink()
    }
  }, [auth, demo, bluetooth])

  /*
   * Setlists and stars, kept in step with the Mac.
   *
   * This is the point of them. A night's running order is built at the bench,
   * with a keyboard, and then played from the phone on the stand — so it has to
   * be the same list in both places. lib/cloudSetlists pulls once when the app
   * opens and pushes a couple of seconds after anything changes here.
   *
   * Not tied to the Mac being reachable: this is the account's copy, and fixing
   * tomorrow's running order on the sofa is a thing somebody does with the rig
   * switched off.
   */
  useEffect(() => {
    if (auth !== 'in') return undefined
    /*
     * NOT IN THE DEMO, and this one was costing something real.
     *
     * The demo signs itself in as far as this screen is concerned, so the
     * account sync ran under it — pushing setlists at a database the demo has
     * no business touching, on an account the person looking around may not
     * even have. It is also the opposite of what the demo is for: the point of
     * it is that nothing leaves the phone, so a screen that is slow in the demo
     * is slow for its own reasons.
     */
    if (demo) return undefined
    let alive = true
    let stop = null
    hydrate().then(() => {
      if (alive) stop = keepSetlistsInStep(setPicked)
    })
    return () => {
      alive = false
      stop?.()
    }
  }, [auth, demo])

  /*
   * And what arrived is said out loud.
   *
   * A setlist appearing under Previous and Next without a word would look like
   * the app changing its mind — so it says where it came from, once, and then
   * gets out of the way. Eight seconds: long enough to read between songs,
   * short enough not to be sitting on the stage screen at the next one.
   */
  useEffect(() => {
    if (!picked) return undefined
    const t = setTimeout(() => setPicked(null), 8000)
    return () => clearTimeout(t)
  }, [picked])

  return (
    <SafeAreaProvider>
      {/* The clock and the battery, which have to be readable against whatever
          is behind them: light ink on the dark palette, dark on the light one. */}
      <StatusBar style={isDark() ? 'light' : 'dark'} />
      {/* Clear of the phone's own on every side, not only the top and the
          bottom: the strip down the side where the iPhone Duo keeps its clock
          and camera, a tablet's camera on its side. A phone held upright has
          nothing down its sides, so nothing on it moves (lib/screenShape). */}
      <SafeAreaView style={{ flex: 1, backgroundColor: color.chassis }} edges={SAFE_EDGES}>
        {/* Not until BOTH answers are in: which screen opens depends on the
            two of them together, and acting on the first to arrive is what
            flashed a sign-in form at somebody's first launch. */}
        {auth === 'checking' || seenWalk === null ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl }}>
            <ActivityIndicator color={color.silkDim} />
            {/* Fractal Audio's sentence, every launch, while the app starts:
                in small type that can be read, and costing no wait, because
                this screen is only up while two stored answers load (a
                fraction of a second). The card below is the one that is sure
                to be seen; this is the reminder. */}
            <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: Math.round(font.small * 1.45), textAlign: 'center' }}>
              {NOT_AFFILIATED}
            </Text>
          </View>
        ) : independentDue ? (
          /*
           * "An independent app", once, before anything else (Fractal
           * Audio's letter, 18 October 2026): in place of the walkthrough,
           * the sign-in or Play, never over them. OK remembers it and the
           * app opens where it would have.
           */
          <IndependentNotice
            onDone={() => {
              markIndependentNotice()
              setIndependentDue(false)
            }}
          />
        ) : seenWalk === false ? (
          /*
           * NOT `auth === 'out' && !seenWalk`, WHICH IS THE BUG THIS LINE HAD.
           *
           * "The show me the walkthrough isn't working anymore from the
           * settings menu. When you click it you feel the haptic feedback, but
           * then it doesn't go to the screen."
           *
           * It used to be true for a replay only because asking to see the
           * walkthrough again ALSO set the app to signed-out — the very thing
           * that made a replay cost somebody their unlock, and which 1.15.0
           * took out. Take that away and a signed-in person setting seenWalk
           * false meets a condition that is still false: the flag flips, the
           * screen does not, and the tap is a haptic and nothing else.
           *
           * The walkthrough being up is `seenWalk`'s business alone. Who is
           * signed in decides what comes AFTER it, which is what the branches
           * below are for.
           *
           * THE WALKTHROUGH IS THE WAY IN, not a thing laid over it.
           *
           * It explains the arrangement, starts the demo, and hands over to
           * the sign-in screen for anybody joining a phone to a computer —
           * reached in the order somebody actually needs them rather than as
           * four choices on one screen.
           *
           * AND IT NO LONGER HAS AN `onDone`. That finished a walkthrough
           * which had just paired a phone with a code: marked the walkthrough
           * seen, asked whether this account is an owner, and put the app in.
           * No route through it ends that way now — signing in leaves the
           * walkthrough, and the sign-in screen's own onSignedIn does those
           * same two things. The demo has onEnterDemo.
           */
          <>
            <Onboarding
              replay={replaying}
            /*
             * Out, and nothing else. No account touched, no demo started, no
             * walkthrough state rewound — they came to look at it.
             */
            onClose={() => {
              markWalkthrough()
              setSeenWalk(true)
              setReplaying(false)
            }}
            onEnterDemo={() => {
              markWalkthrough()
              setSeenWalk(true)
              setReplaying(false)
              setAuth('in')
            }}
            /* The same, and straight on to Settings, where the walkthrough
               can be shown again: the row at the foot of the last page. */
            onSettings={() => {
              markWalkthrough()
              setSeenWalk(true)
              setReplaying(false)
              setAuth('in')
              openSettings()
            }}
            /*
             * Out of the walkthrough and onto the sign-in screen.
             *
             * The walkthrough's way in is a code off a running computer, and
             * somebody already signed in elsewhere has no such code. This is
             * their door: `out` is the state that draws SignIn, which signs
             * in, makes an account and resets a password — all of it already
             * written and tested, rather than a second form here.
             *
             * The walkthrough is marked seen on the way past, the same as
             * every other exit from it. Sending somebody back to the start of
             * a first-run flow they have just walked out of would read as the
             * app forgetting what they did.
             */
            onAccount={() => {
              markWalkthrough()
              setSeenWalk(true)
              setReplaying(false)
              setAuth('out')
            }}
              /*
               * THE UNLOCK BUTTON BUYS THE APP, which it did not until now.
               *
               * "The unlock button and the two buttons at the bottom where it
               * says sign in and the button where it says restore purchase,
               * all take you to the other screen." Three buttons saying three
               * different things, all landing on the sign-in form — because
               * this one advanced the walkthrough rather than opening the
               * paywall, and the walkthrough's next step is sign-in.
               */
              onUnlock={() => setBuying(true)}
            />
            {/*
              AND THE PAYWALL IS DRAWN HERE TOO, or that button does nothing.

              The other one lives inside the signed-in branch, which the
              walkthrough is not, so `buying` could go true and nothing would
              appear. A button that fires a haptic and changes no pixels is
              worse than the wrong screen.

              `onUnlocked` goes to sign-in rather than just closing. A purchase
              is anonymous until an account claims it — which is exactly how
              Justin's own test purchase landed on a handset id instead of on
              him — and SignIn's linkAccount is what claims it. An account is
              needed to reach the computer anyway, so this is a step earlier,
              not a step extra.
            */}
            {buying ? (
              <Paywall
                asked
                /*
                 * Out of the walkthrough as well as into the sign-in. toSignIn
                 * alone set auth to 'out' and left the walkthrough standing —
                 * it is drawn ahead of the sign-in screen — so the sheet closed
                 * and nothing else happened: "Sign in with an email and
                 * password" did nothing at all from here.
                 */
                onSignIn={() => {
                  markWalkthrough()
                  setSeenWalk(true)
                  setReplaying(false)
                  toSignIn()
                }}
                onUnlocked={() => {
                  setBuying(false)
                  markWalkthrough()
                  setSeenWalk(true)
                  setReplaying(false)
                  setAuth('out')
                }}
                onDemo={() => {
                  setBuying(false)
                  setDemo(true)
                  markWalkthrough()
                  setSeenWalk(true)
                  setReplaying(false)
                  setAuth('in')
                }}
                onBack={() => setBuying(false)}
              />
            ) : null}
          </>
        ) : auth === 'out' ? (
          <>
          <SignIn
            /* Create account, after buying with nobody signed in: he was met
               with Sign in, which failed four times, and made the account on
               the website, which then sold it to him again. */
            start={signInSide}
            /* Paid here and on no account somebody has signed in to: the
               phone's nameless id, an account made here (a mistyped email,
               a confirmation still to come), or one it is on its way to. */
            paidHere={purchase.onlyHere || purchase.madeHere || purchase.stuck}
            /* And when it is that made-here account, the screen says so: it
               has the purchase, and one made again takes it with it. */
            madeHere={purchase.madeHere}
            onAccountMade={(id) => {
              setSignInSide('in')
              linkNewAccount(id)
            }}
            onSignedIn={() => {
              /* An owner signing in is unlocked from that moment, not from
                 the next launch — the check at startup ran before there was
                 an account to read. */
              checkOwner()
              /* And so is somebody who bought this on another phone. The
                 purchase follows the account, so signing in is what tells
                 RevenueCat which account to answer for. */
              const linked = linkAccount()
              /*
               * AND THE DEMO ENDS, because signing in is heading for a real
               * rig. "When I sign in, it takes me directly to the demo."
               *
               * The way OUT to this screen already cleared it — toSignIn does
               * — but the way back IN did not, so somebody who tapped Try the
               * Demo from the sign-in form, looked around, then signed in,
               * came back to a simulated unit with their real one waiting.
               *
               * The two halves of one door now agree.
               */
              setDemo(false)
              /*
               * ON A SPINNER UNTIL THE ACCOUNT'S UNLOCK IS KNOWN. A tester
               * Justin gave access to is unlocked by the server a second or
               * two after the store first says no, and going straight in put
               * the price in front of them for those seconds. linkAccount
               * waits for that answer, and lets go on its own if it is slow.
               */
              setAuth('checking')
              linked.then(() => setAuth('in'))
            }}
            onDemo={() => setAuth('in')}
          />
          {/* No purchase page from here any more: Create account makes an
              account for anybody (see SignIn), and one that has not been
              unlocked signs in to the purchase page below. */}
          </>
        ) : auth === 'paywall' ? (
          <Paywall
            onSignIn={toSignIn}
            onUnlocked={() => setAuth('in')}
            onDemo={() => {
              /* Out of the paid path entirely: the demo needs no account and
                 no unit, so the leftover session goes with it — and the
                 store stops answering as that account, the way Settings →
                 Sign out does. Left on it, a purchase made in the demo went
                 to the account just left, and the one made next got none. */
              setDemo(true)
              signOut().catch(() => {})
              unlinkAccount().catch(() => {})
              allowBluetooth(null, { signedOut: true })
              setAuth('in')
            }}
            onBack={() => {
              signOut().catch(() => {})
              unlinkAccount().catch(() => {})
              allowBluetooth(null, { signedOut: true })
              setAuth('out')
            }}
            /* Apple's 5.1.1(v), on the one page an unpaid account can reach:
               the account is gone, so its session goes with it, and the
               store's link to it — a purchase put on a deleted account is
               one nobody can ever sign in to. */
            onDeleted={() => {
              signOut().catch(() => {})
              unlinkAccount().catch(() => {})
              allowBluetooth(null, { signedOut: true })
              setAuth('out')
            }}
          />
        ) : (
          <>
            {/*
              The name in the corner means two things, so it goes two places.
              In the demo it is a CHOICE — five units, and the sheet is one tap
              — and outside it it is a FACT, so it opens Setup where the facts
              are. It used to do the second thing in both cases, which sent
              somebody after the demo picker on a walk through Setup and into
              a page named after pairing a phone.
            */}
            {purchase.posing ? (
              <Press label="Viewing as a new customer · tap to stop" tone="signal" on onPress={() => poseAsNewCustomer(false)} />
            ) : null}
            <TopBar
              link={shownLink}
              onOpenSettings={() => openSettings()}
              /* The note under the pill, over Bluetooth: back to the screen it was opened over. */
              onReport={reportBluetooth ? (said) => reportBluetooth(screen, said) : null}
              onUnlock={() => setBuying(true)}
              onOpenUnit={() => (unitGoes === 'demo' ? setPickUnit(true) : unitGoes === 'which' ? setPickLive(true) : openSettings('link'))}
              unitGoes={unitGoes}
              /* Edit has its own Save; two on one screen would be one too many. */
              saveHere={screen !== 'edit'}
            />
            <DemoUnit open={pickUnit} onClose={() => setPickUnit(false)} />
            <LiveUnit
              open={pickLive && !demo}
              onClose={() => setPickLive(false)}
              hosts={link.hosts}
              units={link.units}
              chosen={link.chosenHost}
              missing={link.missingPick}
              asking={link.unitsAsking}
            />
            {/* Over the top of whatever is on screen, and gone again on a
                tap. Nothing behind it is being withheld — they came looking
                for this, so Back means back, not out. */}
            {buying ? (
              <Paywall
                asked
                onSignIn={toSignIn}
                onUnlocked={() => setBuying(false)}
                onDemo={() => setBuying(false)}
                onBack={() => setBuying(false)}
              />
            ) : null}
            {picked ? <Arrived picked={picked} /> : null}
            {/* A downloaded update, offered as a restart. Here, in the column,
                on every screen but Play; on Play it floats (below). When the
                app takes it by itself instead, see lib/update-rule.js. */}
            {playOnScreen ? null : <UpdateReady />}
            {/* A computer on another account, said on the stage too and not
                only in Setup — Waking says it for itself while it is up.
                Not over Bluetooth, where no computer is being looked for. */}
            <WrongAccount
              active={auth === 'in' && !demo && !settling && screen === 'stage' && link.link !== 'connected' && !bluetooth}
              onSwitch={() => openSettings('link')}
              onTroubleshoot={openConnectFix}
              onSaying={setElsewhereSaid}
            />
            {/*
              The bar stays up while this waits, which is what makes the wait
              safe: whatever happens, Setup is one tap away in the corner.
            */}
            {/*
              SWIPE IN FROM THE LEFT TO GO BACK ONE STEP, on every screen that
              has a way back.

              "Swiping back should always take them to the previous screen."

              One wrapper rather than one per screen, because the thing it
              needs to know — where back IS from here — already lives here, in
              the same `onBack` each screen is handed a line below. Settings
              is the exception and carries its own: it is the only screen with
              pages INSIDE it, so only it can say whether back means its own
              list or the stage.

              `null` on the stage screen itself: there is nowhere behind it,
              and a gesture that does nothing is worse than none at all.
            */}
            <EdgeBack onBack={backFrom}>
            {settling && screen === 'stage' ? (
              <Waking
                link={link}
                long={lookedLong}
                onRetry={probeNow}
                onSwitch={() => openSettings('link')}
                onTroubleshoot={openConnectFix}
                onBluetooth={bluetoothOffered ? () => openSettings('bluetooth') : null}
                onReport={reportBluetooth ? (said) => reportBluetooth('stage', said) : null}
                onSetlists={() => setScreen('setlists')}
              />
            ) : screen === 'presets' ? (
              <Presets onBack={() => setScreen('stage')} />
            ) : screen === 'setlists' ? (
              <Setlists onBack={() => setScreen('stage')} />
            ) : BENCH && screen === 'edit' ? (
              <Edit
                onBack={() => setScreen('stage')}
                onOpenGear={() => {
                  setGearBack('edit')
                  setScreen('gear')
                }}
              />
            ) : screen === 'connect' ? (
              <Connect onBack={() => setScreen('settings')} />
            ) : screen === 'gear' ? (
              <Gear onBack={() => setScreen(gearBack)} />
            ) : screen === 'log' ? (
              /* It sends the log itself now, from the one screen where
                 somebody is already looking at the thing worth sending: Send
                 logs to developer went to the Feedback form, which sends
                 nothing until something is typed, and so it sent nothing.
                 The form is still reached from Setup. */
              <Log onBack={() => setScreen('settings')} />
            ) : screen === 'report' ? (
              /*
               * Report a Bluetooth problem when a Bluetooth place opened it,
               * through the page's own gate again in case that changed since;
               * the Feedback form otherwise, exactly as it was. "Write it out"
               * on the first opens the second, with the same way back.
               */
              reportAbout === 'bluetooth' && bluetoothOffered ? (
                <BluetoothReport said={reportSaid} onBack={() => setScreen(reportFrom)} onWriteMore={() => setReportAbout(null)} />
              ) : (
                <Report onBack={() => setScreen(reportFrom)} />
              )
            ) : screen === 'fixes' ? (
              /* Works with the computer off, which is exactly when it is
                 wanted. The version it can check is the one the computer last
                 told us; with nothing there it says so.

                 `back` is where Done returns to, because this screen is
                 reached two ways: from Setup, and from an error on the stage
                 screen. Coming back to Setup from an error you hit while
                 playing would be the wrong room. */
              <Fixes
                onBack={() => setScreen(fixFrom)}
                open={fixOpen}
                hostVersion={link.hostVersion}
              />
            ) : screen === 'settings' ? (
              <Settings
                key={settingsVisit}
                startPage={settingsAt}
                onPage={setSettingsAt}
                onUnlock={() => setBuying(true)}
                onSignIn={toSignIn}
                onMakeAccount={toMakeAccount}
                /* No computer has ever signed in with this account, said for certain (useNoComputer, above). */
                noComputer={noComputer}
                /* As the top bar says it, so the page under it does not flip either (useHeldLink). */
                link={shownLink.link}
                macName={link.macName}
                hostVersion={link.hostVersion}
                onBack={() => setScreen('stage')}
                /* Works with the Mac off: it is a reference sheet, not a
                   question for the unit. */
                onOpenGear={() => {
                  setGearBack('settings')
                  setScreen('gear')
                }}
                /* Back to the start of the walkthrough. It replaces the
                   whole app while it is up, the same as on a first run. */
                /*
                 * Back to the start of the walkthrough — and NOTHING ELSE.
                 *
                 * This used to set the app to signed-out on the way. It did
                 * not drop the session, but it meant the walkthrough's exits
                 * were the only way back in, and the one that looked like a
                 * way forward started the demo — which takes somebody off the
                 * rig they were driving. "Now my only option is to start the
                 * demo again, which made me re sign in again to unlock."
                 *
                 * It replaces the whole app while it is up, the same as on a
                 * first run; who is signed in is none of its business.
                 */
                onReplay={() => {
                  setScreen('stage')
                  setReplaying(true)
                  setSeenWalk(false)
                }}
                /* Developer → View as a new customer: the walkthrough again, and
                   every screen told this phone has not unlocked, until the
                   banner over the play screen is tapped. See poseAsNewCustomer. */
                onViewAsCustomer={() => {
                  poseAsNewCustomer(true)
                  setScreen('stage')
                  setReplaying(true)
                  setSeenWalk(false)
                }}
                /* The screen somebody needs most when nothing is connected,
                   which is exactly when the rest of Setup can do nothing. */
                onOpenConnect={() => setScreen('connect')}
                /* Works with the Mac off, and is most wanted when it is off. */
                onOpenLog={() => setScreen('log')}
                /* Works signed out and with the Mac off, which is when most of
                   what people want to complain about happens. */
                onOpenReport={() => openReport('settings')}
                /* The Bluetooth page's own report, back to the page (Settings keeps its page, settingsAt). */
                onReportBluetooth={reportBluetooth ? (said) => reportBluetooth('settings', said) : null}
                /* Same, and more so: a guide to what to try is the one screen
                   that has to work when nothing else does. */
                onOpenFixes={() => {
                  setFixOpen(null)
                  setFixFrom('settings')
                  setScreen('fixes')
                }}
                onReconnect={probeNow}
                onSignOut={async () => {
                  /*
                   * The loop stops before the session goes, not after. Left
                   * running, its next turn tries to rejoin an account that is
                   * on its way out and lands on the sign-in screen as an error
                   * about not being signed in — which is true, and is not
                   * something anyone needs telling after tapping Sign out.
                   */
                  await stopLink()
                  await signOut()
                  /* Stop answering as that person. It never takes an unlock
                     away — see unlinkAccount — so somebody who bought on this
                     phone and signed out of an account keeps what they paid
                     for. */
                  unlinkAccount().catch(() => {})
                  allowBluetooth(null, { signedOut: true })
                  setScreen('stage')
                  setAuth('out')
                }}
              />
            ) : (
              <Stage
                /* An error on the stage screen can name the fix for it, and
                   Done comes back here rather than to Setup. */
                onOpenFix={(id) => {
                  setFixOpen(id)
                  setFixFrom('stage')
                  setScreen('fixes')
                }}
                /* Only once the Mac is answering: a list of slot numbers with
                   no names behind them is a screen that cannot do its one job. */
                onOpenPresets={
                  /* The demo is its own far end: always answering. */
                  demo || link.link === 'connected' ? () => setScreen('presets') : null
                }
                /*
                 * The setlist, unlike the preset list, works with the Mac off.
                 * It is storage and nothing else — the running order for
                 * tonight is a thing you fix on the sofa, and refusing to open
                 * it because the rig is not plugged in would be refusing the
                 * one screen in this app that never needed the rig.
                 */
                onOpenSetlists={() => setScreen('setlists')}
                /*
                 * The bench, behind the switch in lib/features for this release.
                 * Only once the Mac is answering either way: every control on
                 * that screen is read off the unit, so with nothing on the other
                 * end it is a screen of empty knobs.
                 *
                 * And never over Bluetooth (beta), which carries playing and
                 * nothing else: no knobs, no models, no saving.
                 */
                onOpenEdit={
                  BENCH && (demo || link.link === 'connected') && !overBluetooth(caps) ? () => setScreen('edit') : null
                }
                onUnlock={() => setBuying(true)}
                onAccount={toMakeAccount}
                /* The colours' one-time line, pressed: Settings, open on Colors. */
                onOpenColours={() => openSettings('colours')}
                /* A fault on Play while over Bluetooth: Report this, under What to try, and back here. */
                onReport={reportBluetooth ? (said) => reportBluetooth('stage', said) : null}
                /*
                 * THE COMPUTER GONE FOR FIFTEEN SECONDS WITH A RIG ON SCREEN:
                 * the waiting screen's advice and its two buttons, floated
                 * over the play screen the way its faults are, so nothing
                 * under a thumb moves. Not over Bluetooth (beta), where a
                 * lost adapter brings the waiting screen back over the rig
                 * with its own words (`settling`, above), and not while the
                 * stage is already saying the computer is on another account.
                 */
                /*
                 * NOT CONNECTED over dimmed tiles, the moment link.js says the
                 * link has been down long enough to mean it (see
                 * LINK_DOWN_HOLD_MS). Never in the demo, which has no link.
                 */
                down={link.down === true && !demo}
                noComputer={noComputer}
                lost={lookedLong && !bluetooth && !elsewhereSaid}
                lostAway={lostAway}
                onPutAway={() => setLostAway(true)}
                onLookAgain={probeNow}
                /* Which computers answered, and which is driven: Play says when that is not where the unit is (ComputerCard). Never in the demo. */
                computers={demo ? null : link}
                onOpenUnits={() => setPickLive(true)}
              />
            )}
            {/* Over the play screen and never in it, where the fault floats,
                and out of the way while the fault or the advice is up. */}
            {readyOverPlay ? <UpdateReady over /> : null}
            </EdgeBack>
          </>
        )}
        {/* The metronome's beat, over everything and pressing nothing. */}
        <MetronomeBeat bpm={rigBpm} />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

/**
 * What the account just handed this phone, in a sentence.
 *
 * Only ever drawn when something actually arrived — `gained` counts the
 * setlists and stars this phone did not already have, so a sync that changed
 * nothing says nothing.
 */
function Arrived({ picked }) {
  const parts = []
  if (picked.gained?.lists) {
    parts.push(`${picked.gained.lists} setlist${picked.gained.lists === 1 ? '' : 's'}`)
  }
  if (picked.gained?.stars) {
    parts.push(`${picked.gained.stars} star${picked.gained.stars === 1 ? '' : 's'}`)
  }
  if (!parts.length) return null
  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
      <Note>{`Picked up ${parts.join(' and ')} from ${picked.from || 'your other device'}.`}</Note>
    </View>
  )
}

const ofCaps = (s) => s.capabilities
const ofError = (s) => s.error

/**
 * The link as the top bar and Setup say it, through a stretch of looking.
 *
 * The same as the link, except at one point: once this stretch of looking
 * has heard nothing back ('no-answer'), the rejoins in between say so too,
 * rather than amber CONNECTING for a second and a half before the next red
 * DISCONNECTED. His log on 12 October 2026 swung between the two every six
 * and a half seconds for minutes, with the computer asleep the whole time.
 *
 * `looking` going false ends it: the computer answered, or the app is
 * signed out, in the demo, or between links. A new `what` — the computer or
 * the adapter — starts again from nothing, so a computer that did not
 * answer is never held against an adapter being found. Over Bluetooth
 * (beta) there is no 'no-answer' to hold.
 */
function useHeldLink(link, looking, what) {
  const [missed, setMissed] = useState(null)
  useEffect(() => {
    if (!looking) setMissed(null)
    else if (link.link === 'no-answer') setMissed(what)
  }, [looking, link.link, what])
  return looking && link.link === 'joining' && missed === what ? { ...link, link: 'no-answer' } : link
}

/* How long "Finding your computer…" stands on its own before it says more. */
const WAKING_LONG_MS = 15000

/**
 * Whether the link has been out looking for WAKING_LONG_MS with no answer:
 * the waiting screen's advice, and the same advice over the play screen.
 *
 * HELD UP HERE, ABOVE BOTH SCREENS, rather than inside Waking. Inside, it was
 * started again at every change of link.link, which during the flip was
 * every few seconds, and Waking itself was taken off the screen at every
 * 'no-answer', which threw the clock away with it. Fifteen seconds never
 * came, so the advice never showed.
 *
 * `looking` going false ends the stretch: the computer answered, or the app
 * is signed out, in the demo, or between links. A new `again` starts a new
 * one: what is looked for changing, the computer or the adapter.
 *
 * TIME AWAY FROM THE SCREEN DOES NOT COUNT. A phone put to sleep holds its
 * timers, and Android drops the connection as it goes, so coming back after
 * a minute in a pocket would fire the clock at once and float the advice over
 * a play screen that reconnects a second later. Coming back starts the
 * fifteen seconds again, unless the advice was already up when the phone
 * went away: that was for a reason a pocket has not fixed.
 *
 * AWAY MEANS 'background', NOT iOS's 'inactive'. That is Control Center or
 * Notification Center pulled down, the app switcher's first peek, a system
 * alert: the app keeps running under all of them. Counted as away, a swipe
 * down to check the wifi — the natural thing to do when the phone cannot
 * find the computer — started the fifteen seconds again, and took away
 * advice that had come up underneath while it was open.
 */
function useLookedLong(looking, again) {
  const [long, setLong] = useState(false)
  const shown = useRef(false)
  useEffect(() => {
    shown.current = long
  }, [long])
  const [back, setBack] = useState(0)
  useEffect(() => {
    let away = false
    let shownWhenLeft = false
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'background') {
        if (!away) shownWhenLeft = shown.current
        away = true
      } else if (status === 'active') {
        if (away && !shownWhenLeft) setBack((n) => n + 1)
        away = false
      }
    })
    return () => sub.remove()
  }, [])
  useEffect(() => {
    setLong(false)
    if (!looking) return undefined
    const t = setTimeout(() => setLong(true), WAKING_LONG_MS)
    return () => clearTimeout(t)
  }, [looking, again, back])
  return long
}

/**
 * The few seconds before there is a rig to show, said out loud.
 *
 * One line, in the words of the thing actually happening, because "Loading…"
 * over a spinner tells somebody standing in front of a silent rig nothing they
 * can act on — and what they can act on is usually the Mac.
 */
function Waking({ link, long, onRetry, onSwitch, onTroubleshoot, onBluetooth, onReport, onSetlists }) {
  /*
   * OVER BLUETOOTH (BETA) THERE IS NO COMPUTER TO FIND. What is being looked
   * for is the adapter on the unit — the link names it, so the line below
   * already says "Finding" it — and everything about the computer and its
   * account is left out: it would be advice about something not in use.
   * What stands in the way, when the phone knows (its Bluetooth off, Nearby
   * devices refused), is said instead of the plugs.
   */
  const bluetooth = useBluetoothOn()
  const trouble = useBluetoothTrouble()
  const said =
    link.link === 'connected'
      ? 'Asking your unit what it is\u2026'
      : `Finding ${link.macName || 'your computer'}\u2026`
  /*
   * WHICH ACCOUNT THIS IS, while it looks. "Shouldn't we have it say when
   * it's trying to connect, say, make sure you're connected to your computer
   * using and then show the user's email address?" — the night the browser
   * would not connect, it was signed in as a second account and nothing said
   * so. Only while it is still finding the computer: once the computer has
   * answered, the account was right.
   */
  const [email, setEmail] = useState(null)
  useEffect(() => {
    let live = true
    currentAccount().then((a) => live && setEmail(a?.email && !isPairAccount(a.email) ? a.email : null))
    return () => {
      live = false
    }
  }, [])
  /*
   * AND IT STOPS JUST SPINNING. "Been stuck on connecting screen for over a
   * minute on iOS. How long until it times out and displays troubleshooting
   * or refresh button. I usually force close." It never did: a join that
   * fails goes back to joining, so this screen could spin for as long as the
   * app was open, with nothing to press. After fifteen seconds it says what
   * to check — the phone's own sentence from Setup — and offers the same
   * button Setup has. The gear is still up top for a different account.
   *
   * That night the phone was signed in as one account and the computer as
   * another, and the line above names the one this phone is using.
   *
   * `long` is App's clock (useLookedLong), not this screen's own. This one
   * restarted at every change of link.link and died with the screen at every
   * 'no-answer', so on 12 October 2026 the fifteen seconds never came: "App
   * keeps jumping back-and-forth from this page every few seconds instead of
   * offering suggestions on what to check".
   */
  /*
   * AND WHEN THE ACCOUNTS DON'T MATCH, IT SAYS SO. "I was signed into the
   * wrong account, but it didn't notify me at all… Please be clear which
   * account needs to be trying to sign into, or which one it is signing into,
   * and they don't match somehow." A computer on another account never
   * hears this phone, and until now that looked exactly like a computer that
   * was off. The account server can tell: a computer on this wifi, signed
   * into a different account, is a yes (lib/useComputerElsewhere.js).
   *
   * Asked from the first second of looking, not when the advice comes up.
   * Asked then, the advice opened on "make sure the computer is awake" and
   * turned into the account warning a moment later when the answer came,
   * and did it again after every trip to Settings and back, because the
   * answer went with the screen. The note itself still waits for `long`.
   */
  const elsewhere = useComputerElsewhere(link.link !== 'connected' && !bluetooth)
  /*
   * AND NO COMPUTER EVER SIGNED IN WITH THIS ACCOUNT, when the account
   * server has said so for certain. Asked on App's clock, `long`, the same
   * moment as App's own question and from the same memory
   * (lib/useNoComputer.js), so it is one question a minute however many
   * screens ask it. Said in place of "make sure the computer is awake", and
   * only once the account warning has had its answer and it was no: a
   * computer on this wifi on another account is the truer reason, and its
   * warning always wins.
   */
  const noComputer = useNoComputer(long && !bluetooth)
  const noneSaid = Boolean(noComputer) && !bluetooth && elsewhere === false
  /*
   * Centred when it fits, and scrolled when it does not: with Send me the
   * download link under the words, the column is taller than a small phone
   * with Display Zoom or a large text size (320 by 548), and a column that
   * cannot scroll was cut at both ends, the spinner under the top bar and
   * Setlists off the bottom.
   */
  return (
    <ScrollView
      accessibilityLiveRegion="polite"
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl }}
    >
      <ActivityIndicator color={color.silkDim} />
      <Text style={{ color: color.silkDim, fontSize: font.body, textAlign: 'center' }}>{said}</Text>
      {/* Not over "No computer is signed in with this account yet", which
          names the account already: beside it, "make sure you're connected"
          is about a computer that is not there. */}
      {email && link.link !== 'connected' && !bluetooth && !noneSaid ? (
        <Text style={{ color: color.silkFaint, fontSize: font.small, textAlign: 'center' }}>
          {'Make sure you’re connected to your computer using '}
          <Text style={{ color: color.silkDim, fontWeight: '700' }}>{email}</Text>.
        </Text>
      ) : null}
      {/*
        THE WAY BACK TO THE COMPUTER, FROM THE FIRST SECOND. "How do I get out
        of Bluetooth mode so I can go back to connecting to computer?" (10
        October 2026, on this screen, with the adapter not there.) The only
        way was the gear, Phone & computer, Bluetooth (beta), Stop — four
        taps from a screen that offered nothing for fifteen seconds and then
        only a way to look again. Turning Bluetooth off is what Stop does,
        and the link starts looking for the computer the moment it is off.
      */}
      {bluetooth ? (
        <View style={{ alignSelf: 'stretch' }}>
          <Press label="Use the computer instead" onPress={() => setBluetooth(false)} />
        </View>
      ) : null}
      {long && link.link !== 'connected' ? (
        <View style={{ alignSelf: 'stretch', gap: space.md }}>
          {bluetooth ? (
            <Note tone={trouble ? 'fault' : 'warn'}>
              {trouble === 'bluetooth-off'
                ? `Bluetooth is off on this ${deviceNoun()}. Turn it on in the ${deviceNoun()}’s settings.`
                : trouble === 'permission'
                  ? `${ALLOW_WORDS}.`
                  : trouble === 'restricted'
                    ? `${RESTRICTED_WORDS}.`
                    : `Check the ${deviceNoun()}’s Bluetooth is on, that the adapter is plugged into the unit’s MIDI In and Out and lit, and that nothing else is connected to it.`}
            </Note>
          ) : elsewhere ? (
            <Note tone="fault">
              {email
                ? `The computer on this wifi is signed into a different account. This ${deviceNoun()} is signed in as ${email}. On the computer, sign in to the Fractal Remote app with ${email}, or sign this ${deviceNoun()} into the computer’s account.`
                : `The computer on this wifi is signed into a different account than this ${deviceNoun()}. Sign both into the same account.`}
            </Note>
          ) : noneSaid ? (
            <Note tone="warn">
              <NoComputerWords email={noComputer.email} />
            </Note>
          ) : (
            <Note tone="warn">
              Open the Fractal Remote app on the computer and make sure the computer is awake. This keeps trying on
              its own.
            </Note>
          )}
          {/*
            AND THE LINK, TO THEIR INBOX, right under the words that say no
            computer was ever set up. "Add a 'Send me the download link'
            button on the three screens where they get stuck" (15 October
            2026). To the account's own address, the one the words name.
          */}
          {noneSaid ? <SendLinkButton email={noComputer.email} /> : null}
          {/* Not the no-computer note's Bluetooth (beta) line here
              (components/NoComputer.js NoComputerOtherWay), which Phone &
              computer draws: this screen has its own way to Bluetooth, the
              button below for somebody with no computer, after the
              computer's own, with what it costs under it. Both together were
              the same pitch twice, the note sending them the long way round
              to the page the button opens in one tap. */}
          {elsewhere && onSwitch ? <Press label={`Switch account on this ${deviceNoun()}`} onPress={onSwitch} /> : null}
          {/*
            The way to what the line above asks for, right under it, as on the
            Bluetooth page: Fractal Remote's own page in the phone's settings.
            Only for 'permission'. 'restricted' is a block that page cannot
            lift, so it gets no button that would promise it could.
          */}
          {bluetooth && trouble === 'permission' ? (
            <Press label="Open Settings" onPress={() => Linking.openSettings().catch(() => {})} />
          ) : null}
          {/* Over Bluetooth, on an iPhone whose adapter has gone, Apple's
              screen first (lib/bluetooth lookForAdapterAgain): the link
              cannot bring it back by itself, and Stop, Connect and the
              screen was three taps mid-set. And said under the button
              whenever the tap will open it (opensApplesScreen,
              APPLE_SCREEN_OPENS), with what to do there: a screen that
              pops up unannounced, Done tapped before Connected, and
              nothing connects. */}
          {bluetooth ? (
            <Press
              label="Look for the adapter again"
              sub={opensApplesScreen() ? APPLE_SCREEN_OPENS : undefined}
              onPress={() => lookForAdapterAgain(onRetry)}
            />
          ) : (
            <Press label="Look for the computer again" onPress={() => onRetry?.()} />
          )}
          {/* Over Bluetooth the adapter's own page, where it is found and
              its status is; the computer's troubleshooting is about a
              computer that is not in use. */}
          {bluetooth && onBluetooth ? <Press label="Bluetooth (beta)" onPress={onBluetooth} /> : null}
          {/*
            REPORT A BLUETOOTH PROBLEM, where a stuck player actually sits:
            fifteen seconds of Finding the adapter, over Bluetooth only. The
            line it was stuck on goes with it. Handed only through the page's
            own gate (App's reportBluetooth).
          */}
          {bluetooth && onReport ? <Press label={REPORT_BUTTON} onPress={() => onReport(said)} /> : null}
          {/*
            AND THE OTHER WAY IN, FOR SOMEBODY WITH NO COMPUTER. Until now the
            only Bluetooth buttons here showed once Bluetooth was already on,
            so a player who bought the app to use an adapter sat on "Finding
            your computer" with nothing to say Bluetooth exists, and the gear
            was the only way to it. After the computer's own button, never
            before it: the computer is the best way, and the line under this
            one says what Bluetooth costs (BLUETOOTH_WAYS_SHORT), and, to a
            customer, that it is for an AM4 only (BLUETOOTH_WAYS_SHORT_AM4,
            by lib/bluetooth offeredAm4Only): an FM9 owner with no computer
            reads that here, not after the page has turned them away. Only
            where App hands it a way in (`onBluetooth`: the row's own gate),
            only while it is off, and never under the account warning: a
            computer on this wifi on another account is right there, and
            the fix is the account, not "No computer?".

            SHORT ENOUGH FOR ONE LINE. A button's label is one line at 15
            points, and "No computer? Connect by Bluetooth (beta)" was about
            296 points, cut on a 360-point Android phone and a 375-point
            iPhone. This one is about 254 at its widest; the line under it
            carries the cost.
          */}
          {!bluetooth && onBluetooth && !elsewhere ? (
            <Press
              label="No computer? Use Bluetooth (beta)"
              sub={offeredAm4Only() ? BLUETOOTH_WAYS_SHORT_AM4 : BLUETOOTH_WAYS_SHORT}
              onPress={onBluetooth}
            />
          ) : null}
          {/* "Open the troubleshooting if it doesn't connect" — the browser's
              connecting screen has the same button. */}
          {onTroubleshoot && !bluetooth ? <Press label="Troubleshooting" onPress={onTroubleshoot} /> : null}
          {/*
            SETLISTS, which never needed the rig. Their only door is on the
            play screen, and this screen stands in front of it for as long as
            nothing answers, so tonight's running order could not be fixed on
            the sofa with the computer shut. Back from them is back here.
          */}
          {onSetlists ? <Press label="Setlists" sub="These work with nothing connected" onPress={onSetlists} /> : null}
        </View>
      ) : null}
      {/*
        FRACTAL AUDIO'S SENTENCE, WHILE IT LOOKS. The screen every signed-in
        player meets at startup, for as long as the computer takes to answer
        (often under a second, sometimes much longer), so it says whose app
        this is not, at the foot, where it reads as small print. There from
        the first frame, so it never moves anything while the screen is up.
        The demo skips this screen; the startup card and About carry it
        there.
      */}
      <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: Math.round(font.small * 1.45), textAlign: 'center' }}>
        {NOT_AFFILIATED}
      </Text>
    </ScrollView>
  )
}
