/* First, so every sentence that names the device knows which one it is on. */
import './src/lib/thisDevice'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ActivityIndicator, Alert, AppState, Appearance, BackHandler, Linking, ScrollView, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

import { color, font, space, isDark, loadGlassStyle, loadMode, setSystemDark, themeVersion, watchTheme } from './src/lib/theme'
import { SAFE_EDGES } from './src/lib/screenShape'
import { loadLooks, looksVersion, watchLooks } from './src/lib/looks'
import { useSolidChrome } from './src/lib/useSolidChrome'
import { haveSession, linkState, probeNow, startLink, stopLink, subscribeLink } from './src/lib/link'
import { currentAccount, keptAccount, signOut } from './src/lib/relay'
import { showPhotoFor } from './src/lib/accountPhoto'
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
import { WHATS_NEW_PAGE } from './src/lib/whats-new-rule'
import { LookUndo } from './src/components/Colours'
import { CablePlugIn } from './src/components/CablePlugIn'
import { watchCables } from './src/lib/cablePlugIn'
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
import GearShareNotice from './src/components/GearShareNotice'
import HowConnect from './src/components/HowConnect'
import { setSharing, shareQuestionDue, startGearShare } from './src/lib/gearShare'
import { howConnectAnswered, howConnectShown, noteLink, readHowConnect, useHowConnectOwed } from './src/lib/howConnect'
import { startBluetoothSeen } from './src/lib/bluetoothSeen'
import { NOT_AFFILIATED } from './src/lib/affiliation'
import { walkthroughSeen, markWalkthrough } from './src/lib/walkthrough'
import Edit from './src/screens/Edit'
import EditWhy from './src/components/EditWhy'
import { editDoor } from './src/lib/editDoor'
import Connect from './src/screens/Connect'
import Fixes from './src/screens/Fixes'
import Gear from './src/screens/Gear'
import Log from './src/screens/Log'
import Report from './src/screens/Report'
import Presets from './src/screens/Presets'
import Setlists from './src/screens/Setlists'
import Stage from './src/screens/Stage'
import { hydrate, sync } from './src/lib/store'
import { keepSetlistsInStep } from './src/lib/cloudSetlists'
import { keepVp4SetupIn, vp4Here } from './src/lib/device'
import { clearLinkFault, useRig, writeTuner } from './src/lib/rig'
import { keepLog } from './src/lib/logKeep'
import { installCrashCapture } from './src/lib/debugLog'
import { restoreDemo, setDemo, useDemo, useDemoUnit } from './src/lib/demo'
import {
  ALLOW_WORDS,
  APPLE_SCREEN_OPENS,
  RESTRICTED_WORDS,
  adapterInsteadOfCable,
  allowBluetooth,
  editBuiltFor,
  editOverBluetooth,
  lookForAdapterAgain,
  opensApplesScreen,
  restoreBluetooth,
  setBluetooth,
  turnOnBluetooth,
  useBluetoothOn,
  useBluetoothTrouble,
  useCableNow
} from './src/lib/bluetooth'
import { useBluetoothOffered } from './src/lib/useBluetoothOffered'
import { BLUETOOTH_WAYS_SHORT, REPORT_BUTTON } from './src/lib/bluetooth-gear'
import bluetoothIcon from './assets/icons/bluetooth.png'
import { CABLE_LOOK_AGAIN, CABLE_TO_ADAPTER, CABLE_TO_ADAPTER_SUB, CABLE_WAITING } from './src/lib/cableWords'
import { overBluetooth } from './src/lib/bleSwitch'
import { BENCH, HOLD_KNOBS_FOR_EVERYONE, PHONE_SIDEWAYS_FOR_EVERYONE, SIDES_FOR_EVERYONE } from './src/lib/features'
import Sides, { SidesFrame } from './src/components/Sides'
import SidesLead from './src/components/SidesLead'
import PlayHead from './src/components/PlayHead'
import { usePlayHead } from './src/lib/playHead'
/* Whose sign-in is kept on this device, for the two sides: the same answer Bluetooth's gate reads. */
import { useBluetoothAdmin } from './src/lib/bluetooth'
import { BLOCK, backUnwinds, blockGivesBack, holdGoes, leadReach, panelKeeps, phoneSidewaysOn, sideTools, sideUnder, tunerGivesBack, tunerGoes, tunerStops, twoSidesOn, whenNarrow } from './src/lib/twoSides'
import BlockSide, { KnobsFollow } from './src/components/BlockSide'
/* The hold pop-up's knobs, over its channels: the rule, and the switch that opens it past his account. */
import { popKnobsOn } from './src/lib/holdPop'
import { HOLD_POPUP_KNOBS_FOR_EVERYONE } from './src/lib/features'
/* The handle on the line between the two sides (lib/sidesSplit; components/SidesHandle), the tidier Edit's: his account until its switch. */
import { handleOn } from './src/lib/sidesSplit'
import { useSidesSplit } from './src/lib/useSidesSplit'
import { TIDY_EDIT_FOR_EVERYONE } from './src/lib/features'
/* Three across on a very wide window (lib/threeSides): a second tool beside the first, his account until its switch. */
import { THREE_SIDES_FOR_EVERYONE } from './src/lib/features'
import { thirdOffered, thirdShown, thirdStep, thirdTools, threeSidesOn } from './src/lib/threeSides'
import { SIDES_TALL } from './src/lib/twoSides'
import { SONG_NOTES_FOR_EVERYONE, STAGE_VIEW_FOR_EVERYONE } from './src/lib/features'
import { STAGE_VIEW, STAGE_VIEW_NAME, stageViewOn } from './src/lib/stageView'
import { notesOffered, songNotesOn } from './src/lib/songNotes'
import { NotesSide } from './src/components/SongNotes'
import { listsFor, sourceFor } from './src/lib/lists'
import { useStored } from './src/lib/store'
import { TunerSide } from './src/components/Tuner'
import { PLAY_ON_RIGHT, keepPlayOnRight, readPlayOnRight } from './src/lib/sidesKeep'
import Paywall from './src/screens/Paywall'
import { checkOwner, linkAccount, linkNewAccount, poseAsNewCustomer, startPurchases, trialOnOffer, unlinkAccount, usePurchase } from './src/lib/purchases'
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
  useSolidChrome()
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
  /*
   * WHETHER "HELP MAKE FRACTAL REMOTE BETTER?" IS STILL OWED (components/
   * GearShareNotice, 26 October 2026): never answered on this device
   * ('first'), or a Yes given to its words before 4 November 2026, which
   * said less ('again'). Read with the other two, so it is known before
   * anything is drawn, but shown only after all of them (see `askShare`,
   * below).
   */
  const [shareDue, setShareDue] = useState(false)
  /*
   * AND WHETHER A UNIT HAS CONNECTED ON THIS DEVICE BEFORE, read once at
   * launch (lib/howConnect): the sharing card waits for a launch after the
   * first connection, rather than standing between a new customer's trial
   * and their rig (Justin, 7 November 2026: "Signup was difficult").
   */
  const [connectedBefore, setConnectedBefore] = useState(false)
  useEffect(() => {
    /* A first run is told where Match my unit is too, on Play after the walkthrough (components/ColoursNotice): nothing is marked here for it. */
    Promise.all([walkthroughSeen(), independentNoticeSeen()]).then(([seen, noticed]) => {
      setIndependentDue(!noticed)
      setSeenWalk(seen)
    })
  }, [])
  /*
   * Its own read, apart from the two above (whose shape several tests hold):
   * one stored word, long answered before the sign-in check that has to
   * come first is. Listening for gear starts here too, and sends nothing
   * unless this device has said Yes (lib/gearShare).
   */
  useEffect(() => {
    shareQuestionDue().then(setShareDue)
    readHowConnect().then((kept) => setConnectedBefore(kept.connectedBefore))
    startGearShare()
    /* And the account server told, once, that this account has connected over Bluetooth (lib/bluetoothSeen), so the setup emails leave it alone. */
    startBluetoothSeen()
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
  /* Your account's sheet, open on arrival: the top bar's photo asks for it (openAccount), and Settings says once it has opened it. */
  const [accountSheet, setAccountSheet] = useState(false)
  /* Where Amp & pedal names goes back to: Settings, or Edit, whichever opened it. */
  const [gearBack, setGearBack] = useState('settings')
  const openSettings = (at = null, sheet = false) => {
    setSettingsAt(at)
    setAccountSheet(sheet)
    setSettingsVisit((n) => n + 1)
    setScreen('settings')
  }
  /* The top bar's photo: "if they tap that, it will take them to their profile to edit it" (Justin, 7 November 2026). */
  const openAccount = () => openSettings('account', true)
  /*
   * Settings → About → What's new, from a new-version card's What's new
   * (components/UpdateReady). Back from it comes up to the Settings list, as
   * from the About row. Null, so the card draws no link, while that page is
   * already the one on screen.
   */
  const whatsNewOpen = screen === 'settings' && settingsAt === WHATS_NEW_PAGE
  const openWhatsNew = whatsNewOpen ? null : () => openSettings(WHATS_NEW_PAGE)
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
   * AND WHAT IT IS ABOUT. Null for the report Settings opens; 'bluetooth' for
   * one Bluetooth's own places open, with the words that were on screen
   * when it was opened (`reportSaid`, a fault line), which go with it. Both
   * are the one screen, Leave feedback or report a problem (screens/Report),
   * so the way back is the one reportFrom it always was, for Back, the swipe
   * and Android's back alike.
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
   * gesture and the button cannot drift into disagreeing. One of them is not
   * a constant — the guide is reached from Setup AND from the stage.
   *
   * Nothing for `stage`: it is the bottom of the stack. Nothing for
   * `settings` either — it wraps itself, because it is the one screen with
   * pages inside it and only it knows whether back means its own list or the
   * way out.
   *
   * And nothing for `report`, which wraps itself too, because only it knows
   * whether something written on it would be lost. It was here, and the
   * swipe went straight back to reportFrom past "Not sent yet", which only
   * its Back button asked (the 2 November 2026 audit). Its Back, the swipe
   * and Android's back all ask the one back() in screens/Report.js now,
   * which still ends at reportFrom.
   */
  const BACK_TO = {
    presets: 'stage',
    setlists: 'stage',
    edit: 'stage',
    notes: 'stage',
    stageview: 'stage',
    connect: 'settings',
    gear: 'settings',
    log: 'settings',
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
   * page listen for themselves first, because they have pages inside them,
   * and so does the report screen, because it asks before throwing away
   * what was written on it.
   *
   * On Play itself, in the demo: "have a little pop-up that says Exit demo?
   * If yes, same action as the exit demo button." Only for somebody who has
   * the Exit demo button, which is somebody who has paid. Everywhere else on
   * Play, back does what Android always does and leaves the app.
   *
   * ADDED ONCE, AND SO HEARD LAST. React Native asks the newest listener
   * first. This one was taken away and added again after every render of the
   * app, which made it the newest whenever anything at all had changed, so it
   * answered ahead of Settings' own: on any page inside Settings (Phone &
   * computer, Bluetooth, Appearance) back went straight to Play instead of
   * one page up (the 2 November 2026 audit). So it is added once, when the
   * app starts and before any screen that listens for itself is drawn, and
   * it reads where the app is now out of a ref, the way EdgeBack reads its
   * onBack. Every screen's own listener is newer, and heard first.
   */
  const hardwareBack = useRef(null)
  hardwareBack.current = () => {
    if (buying) {
      setBuying(false)
      return true
    }
    if (auth !== 'in') return false
    /* A block's knobs open from a hold (Derek's panel): back is its Close, in the side or where the scenes were. */
    if (blockAt !== null) {
      closeBlock()
      return true
    }
    /* Three sides up (lib/threeSides): back closes the third before the first, as its own Done does. */
    if (thirdUp) {
      setThird(null)
      return true
    }
    /* With two sides up: a side filling the window goes back beside Play first, then the side itself closes, as its Done does (lib/twoSides backUnwinds). */
    if (twoSidesUp && backUnwinds({ tool: sideTool, sideFull }) === 'full') {
      setSideFull(false)
      return true
    }
    if (screen !== 'stage') {
      setScreen(BACK_TO[screen] || 'stage')
      return true
    }
    if (demo && purchase.unlocked || (demo && purchase.trialEndsAt)) {
      Alert.alert('Exit demo?', 'Back to your own rig.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Exit demo', onPress: () => setDemo(false) }
      ])
      return true
    }
    return false
  }
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => hardwareBack.current())
    return () => sub.remove()
  }, [])
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
   * A UNIT PLUGGED IN BY USB CABLE while connected another way (lib/cablePlugIn):
   * watched through the same gate as the Bluetooth row, signed in and not in
   * the demo, so nobody the page is not drawn for is offered a cable. Play says
   * what it found (components/CablePlugIn).
   */
  const watchingCables = auth === 'in' && !demo && bluetoothOffered
  useEffect(() => {
    watchCables(watchingCables)
  }, [watchingCables])
  useEffect(() => () => watchCables(false), [])
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
   * A REPORT ON SCREEN THAT SOMETHING IS BEING TYPED INTO: the report
   * screen, either way it was opened, and the log screen with its note box.
   * The note under Play's pill is drawn over every screen, these too, and its
   * Report a problem would open a fresh report in their place, and what was
   * typed, and the pictures and video (kept only by that screen) would go.
   * So it is not offered there.
   */
  const typingReport = screen === 'report' || screen === 'log'
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
    /*
     * Heading for the sign-in form is a sign-out for Bluetooth (beta): off,
     * and written down (lib/bluetooth). Not while he is viewing as a new
     * customer, whose sign-in this keeps: the form's way back to his rig
     * (backToRig) brings Bluetooth back with it.
     */
    if (!purchase.posing) {
      /* Kept, so Back to your own rig can put it back as it was (backToRig): the off written here is for a sign-in as somebody else. */
      bluetoothAtForm.current = bluetooth
      allowBluetooth(null, { signedOut: true })
    }
    setAuth('out')
  }
  /*
   * BACK TO HIS OWN RIG, from the sign-in form, for somebody whose sign-in is
   * still on the phone and who only came to look: "After replaying the new
   * user sequence and exiting, now I'm not logged in anymore. need to fix
   * that so I can view that without actually logging me all the way out"
   * (Justin, 3 November 2026). Signs nothing in or out: it ends the view as
   * a new customer, if one is on, and the demo, and goes back in on the
   * sign-in the phone already holds.
   */
  const backToRig = () => {
    poseAsNewCustomer(false)
    setDemo(false)
    setSignInSide('in')
    /* Bluetooth as it was before the form, once the account is in again (the Bluetooth effect below). */
    bluetoothBack.current = bluetoothAtForm.current
    bluetoothAtForm.current = false
    askedBluetooth.current = false
    setAuth('in')
  }
  /* Whether Bluetooth was on when toSignIn wrote it off, and whether Back to your own rig is to put it back on. */
  const bluetoothAtForm = useRef(false)
  /* Not `restoreBluetooth`: that name is lib/bluetooth's own pick-up at launch, imported above, and a ref of the same name hid it (the review of 3 November 2026). */
  const bluetoothBack = useRef(false)
  /* Left the form any other way than Back to your own rig: what Bluetooth was is nobody's business any more. */
  useEffect(() => {
    if (auth !== 'out') bluetoothAtForm.current = false
  }, [auth])
  /* Whether the view as a new customer started the demo, so ending it from the banner ends that too (and leaves one he was already in). */
  const posedInDemo = useRef(true)
  /*
   * "No computer - I'll use Bluetooth", on the page after a found purchase:
   * it goes to sign-in, as Yes does, and once the account is in, straight
   * on to the Bluetooth page, rather than to Finding your computer…, which
   * offers Bluetooth only after a long wait (the review of 3 November 2026).
   */
  const askedBluetooth = useRef(false)
  useEffect(() => {
    if (auth !== 'in' || !askedBluetooth.current || !bluetoothOffered) return
    askedBluetooth.current = false
    openSettings('bluetooth')
  }, [auth, bluetoothOffered])
  /* Whether a sign-in is on the phone while the form is up: asked each time it comes up (haveSession), for backToRig, and forgotten when it goes. */
  const [keptForBack, setKeptForBack] = useState(false)
  useEffect(() => {
    if (auth !== 'out') return undefined
    let alive = true
    haveSession()
      .then((id) => alive && setKeptForBack(Boolean(id)))
      .catch(() => {})
    return () => {
      alive = false
      setKeptForBack(false)
    }
  }, [auth])
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
   * THE FREE TRIAL TAPPED WITH NOBODY SIGNED IN: Create account, not Sign in.
   * A trial needs an account to belong to, and somebody tapping it from the
   * walkthrough is new: he was sent to Sign in, tapped Start 7-day free trial
   * three times and Sign in once before finding Create account (Justin's log,
   * 7 November 2026). Its own side, 'trial', because 'up' also says "You've
   * paid", which a trial has not (SignIn.js `paid`).
   */
  const toTrialAccount = () => {
    toSignIn()
    setSignInSide('trial')
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
  /* Whether the unit's tuner is on: for the tuner's side, with two sides up. */
  const tunerOn = useRig(ofTunerOn)
  /*
   * A read that failed, or the computer saying it has NO UNIT: either way
   * the unit has said all it is going to, so Play is drawn, never the
   * waiting screen. "The screen starts tripping out until the USB is plugged
   * back into the computer. Just screen alternates between these two
   * screenshots about every 0.25 seconds" (Justin, 6 November 2026, the
   * AM4's cable moved from the computer to the phone and out again). The
   * error alone was the gate: Play came up on a failed read, its arrival
   * read the unit again (Stage reload, refreshAll), the computer's answer
   * of no unit cleared the error, the waiting screen took Play's place, the
   * next read failed, and round again, twice a second. A computer that has
   * said no unit is an answer, and stays one until it says otherwise.
   */
  const readFailed = useRig(ofReadEnded)
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
   * EDIT, AND WHERE IT GOES (lib/editDoor, the one rule): whether Play's
   * Edit opens the bench (`editOpens`), or, over Bluetooth or a USB cable on
   * a unit whose Edit is built and not open here, says why in one line
   * (`editExplained`, components/EditWhy); and whether Edit, open, has had
   * its door shut under it and goes back to Play (`editShut`). Named here
   * and handed to Play by name: test/structure.mjs and test/bluetooth.mjs
   * read this file as text.
   */
  const editHere = editDoor({
    bench: BENCH,
    demo,
    link: link.link,
    down: link.down === true,
    overBluetooth: overBluetooth(caps),
    editOpen: editOverBluetooth(),
    built: editBuiltFor(),
    vp4: vp4Here()
  })
  const editOpens = editHere.opens
  const editExplained = editHere.explained
  const editShut = screen === 'edit' && editHere.shuts
  /* The tap's moment, for EditWhy (zero for none), and the cable's own words while one is in. */
  const [editWhyAt, setEditWhyAt] = useState(0)
  const cableNow = useCableNow()
  /* Edit open with its door shut: back to Play, never a page of reads that fail. */
  useEffect(() => {
    if (editShut) setScreen('stage')
  }, [editShut])
  /*
   * TWO SIDES ON A BIG SCREEN (lib/twoSides, components/Sides). "How do I
   * put these side by side on the iPad?" (Justin, 9 November 2026.) On an
   * iPad on its side, an Android tablet sideways or the iPhone Duo opened,
   * Play keeps one side and Edit, Setlists or All presets takes the other.
   *
   * FOR EVERYONE since 9 November 2026 (features SIDES_FOR_EVERYONE; before
   * that, and again if it is ever turned off, his account only: the sign-in
   * kept on this device is his, useBluetoothAdmin, isAdmin of the same
   * session that lets the phone in, never the account server, which with no
   * signal answers nobody). On every window that shows one screen, nothing
   * below is drawn and the app is exactly as it was.
   *
   * `screen` STAYS THE RECORD OF WHAT IS OPEN. A tool beside Play is still
   * `screen === 'edit'` (or 'setlists', 'presets'): Play's own buttons open
   * it the way they always did, its Done and Android's back close it the way
   * they always did, and the top bar's Save gives way to Edit's as before.
   * What changes is only where it is drawn: where the window shows two sides
   * (`wide`, from the frame under the top bar that SidesFrame measures), the
   * switch below leaves the tool to the host, which draws it beside Play
   * (`alone` is what the switch draws on its own). A tool that fills the
   * window (`sideFull`) is the host's too, on any width, so folding the Duo
   * with Edit full screen leaves Edit exactly as it was.
   *
   * WHEN THE WINDOW SHRINKS TO ONE SCREEN with a tool beside Play (the Duo
   * folded, an iPad's divider dragged), Play is what shows, since that is
   * what is needed mid-song, and the tool is kept (`sideKept`, and
   * `shrunk`); wide again, it comes back by itself. Nothing comes back by
   * itself at launch: `sideKept` starts empty, so the app starts on Play.
   * Which side Play is on is the one thing kept on the device (lib/sidesKeep).
   */
  const sidesAdmin = useBluetoothAdmin()
  const sidesAllowed = SIDES_FOR_EVERYONE || sidesAdmin
  /* The frame under the top bar, as measured: { width, height, left, right }, or nothing yet. */
  const [frame, setFrame] = useState(null)
  const wideWas = useRef(false)
  const big = sidesAllowed && twoSidesOn(frame || {}, wideWas.current)
  wideWas.current = big
  /*
   * A PHONE HELD ON ITS SIDE SPLITS IN TWO AS WELL (lib/twoSides
   * phoneSidewaysOn; lib/sidewaysPlay): "let's split the screen in half
   * kind of like the iPhone duo" (Justin, 10 November 2026). His account
   * until features PHONE_SIDEWAYS_FOR_EVERYONE, and asked only where the
   * big-screen rule said no, so a tablet and the Duo keep that answer.
   * There (`low`) the window shows two sides as a big one does (`wide`),
   * the two sides' buttons in the app's top bar on both (components/
   * SidesLead, `sideLead` below), with two differences: Play lays itself
   * out in two halves of square tiles (Stage `low`), and holding a block is
   * the channel pop-up it always was.
   */
  const sidewaysAllowed = sidesAdmin || (sidesAllowed && PHONE_SIDEWAYS_FOR_EVERYONE)
  const lowWas = useRef(false)
  const low = sidewaysAllowed && !big && phoneSidewaysOn(frame || {}, lowWas.current)
  lowWas.current = low
  const wide = big || low
  /* Where the line between the sides was dragged to on a big screen (lib/useSidesSplit), for an account the tidier Edit is open to (his, until features TIDY_EDIT_FOR_EVERYONE). Null for everybody else, and the sides are where they always were. */
  const tidyAllowed = sidesAdmin || (sidesAllowed && TIDY_EDIT_FOR_EVERYONE)
  const split = useSidesSplit({ allowed: tidyAllowed, big })
  /* Which side's name was tapped in the top bar, for the list components/Sides draws: 'tool' | 'play' | null. */
  const [sideList, setSideList] = useState(null)
  /* Whether Play has its preset and Setlists up in the top bar there (lib/playHead; lib/sidewaysPlay `headUp`). */
  const playHeadUp = usePlayHead() !== null
  const [sideFull, setSideFull] = useState(false)
  const [sideKept, setSideKept] = useState(null)
  const [playOnRight, setPlayOnRight] = useState(PLAY_ON_RIGHT)
  useEffect(() => {
    let alive = true
    readPlayOnRight().then((onRight) => alive && setPlayOnRight(onRight))
    return () => {
      alive = false
    }
  }, [])
  /* The tool a side can hold, by the screen that is open: Edit only behind the bench's switch, as its route is. The tuner is a screen only here, beside Play (step 3). */
  const sideTool = BENCH && screen === 'edit' ? 'edit' : screen === 'setlists' || screen === 'presets' || screen === 'tuner' || screen === 'notes' || screen === BLOCK ? screen : null
  /*
   * STAGE VIEW AND SONG NOTES (lib/stageView, lib/songNotes): his account
   * until their switches in lib/features open them. Stage view is Play's
   * own screen drawn large (screens/Stage draws it over itself), so it has
   * a word of its own here and is never a side; Notes is a tool beside
   * Play, on the list only while a setlist is on. Closed, neither has a way
   * in anywhere, and a screen left on either goes back to Play (below).
   */
  useStored()
  const stageViewAllowed = stageViewOn({ admin: sidesAdmin, everyone: STAGE_VIEW_FOR_EVERYONE })
  const notesAllowed = songNotesOn({ admin: sidesAdmin, everyone: SONG_NOTES_FOR_EVERYONE })
  const stageViewUp = stageViewAllowed && screen === STAGE_VIEW
  const twoSidesUp = sidesAllowed && sideTool !== null && (wide || sideFull)
  /* Play is on screen beside the tool; or kept out of sight at no width while the tool fills the window (Stage `awake`). */
  const playBeside = twoSidesUp && !sideFull
  const playHidden = twoSidesUp && sideFull
  const alone = twoSidesUp ? 'stage' : screen
  /*
   * THREE ACROSS ON A VERY WIDE WINDOW (lib/threeSides): "Three across on
   * the big iPad Pro: Play, Edit and a list at once" (his yes of 10
   * November 2026). His account until features THREE_SIDES_FOR_EVERYONE.
   * Where the frame has room for three (`three`: a 13-inch iPad Pro on its
   * side; never an 11-inch, a fold or a phone), a second tool can open
   * beside the first: `third`, one more word kept here and nothing else.
   * Everything above and below goes on about the FIRST tool (`screen`,
   * `sideTool`) and knows nothing of it: the tuner and a held block's knobs
   * borrow the first side as they always have, and the third stays where
   * it is meanwhile.
   *
   * What happens to it as the first side changes is lib/threeSides
   * thirdStep, asked while drawing (as the shrink below is, and for the
   * same reason: an effect would draw one frame of the wrong sides first):
   * the first side taking the third's tool makes the two change places;
   * the first side closing gives its place to the third; the window
   * narrowing to one screen keeps it, to come back with the first; and
   * leaving Play for another screen forgets it. On a window with room for
   * two but not three it is simply not drawn (`thirdUp`).
   */
  const threeAllowed = sidesAdmin || (sidesAllowed && THREE_SIDES_FOR_EVERYONE)
  const threeWas = useRef(false)
  const three = threeAllowed && big && threeSidesOn(frame || {}, threeWas.current, SIDES_TALL)
  threeWas.current = three
  const [third, setThird] = useState(null)
  /* Whether the third side's own list is open (components/Sides draws it): from Add a side, or from the third side's name. */
  const [thirdList, setThirdList] = useState(false)
  const thirdSeen = useRef(null)
  /* Whether the third side was on screen at the last draw: only then does it take the first side's place. */
  const thirdWasUp = useRef(false)
  const thirdNow = thirdStep({ third: threeAllowed ? third : null, first: sideTool, screen, wide, shown: thirdWasUp.current, seen: thirdSeen.current })
  thirdSeen.current = thirdNow.seen
  if (thirdNow.third !== third) setThird(thirdNow.third)
  /* The first side closed with a third up: the third takes its place. */
  if (thirdNow.screen && thirdNow.screen !== screen) setScreen(thirdNow.screen)
  const thirdUp = thirdShown({ three, beside: playBeside, first: sideTool, third })
  thirdWasUp.current = thirdUp
  /* Edit is the third side's tool, on screen: a held block opens there, and its own Save is the one Save. */
  const thirdEdit = thirdUp && third === 'edit'
  const closeThird = () => setThird(null)
  /* The tool last open, for Two sides in the top bar with Play alone; and a side that fills the window stops doing so when it closes. */
  useEffect(() => {
    /* A block's knobs are never kept for Two sides: they open by a hold, and close for good. */
    if (sideTool === BLOCK) return
    if (sideTool) setSideKept(sideTool)
    else setSideFull(false)
  }, [sideTool])
  /*
   * THE WINDOW SHRUNK TO ONE SCREEN WITH A TOOL BESIDE PLAY (the Duo folded,
   * an iPad's divider dragged): what shows is lib/twoSides whenNarrow's
   * answer, Play, with the tool kept to come back (`shrunk`). Decided while
   * drawing, not in an effect after it: an effect runs after the frame is
   * on screen, and that frame would have drawn the tool on its own (the
   * switch's own branch), taking the host down and Play with it, open
   * sheets and all, for the tool to come back a frame later. Only on the
   * render after one that had the tool beside Play (`wasBeside`), so a tool
   * opened on a phone, which is never beside anything, is left alone.
   */
  const wasBeside = useRef(false)
  const shrunk = useRef(null)
  /* What the tuner's side borrowed: the tool that was there before it (lib/twoSides tunerGivesBack), or null for Play alone. */
  const tunerLent = useRef(null)
  /* And what a block's knobs borrowed, the same way (Derek's panel, below). */
  const blockLent = useRef(null)
  if (wasBeside.current && !wide) {
    const to = whenNarrow({ tool: sideTool, sideFull })
    if (to.screen !== screen) {
      /* Folded with the tuner beside Play: the tuner goes off (its side went, below), and what it borrowed is what comes back when the window widens. */
      shrunk.current = sideUnder(to.keep, { tunerLent: tunerLent.current, blockLent: blockLent.current })
      setScreen(to.screen)
    }
  } else if (screen === 'tuner' && !twoSidesUp) {
    /* The tuner is a screen only in a side: anywhere else (the sides closed to this account, say) it is Play, and the tuner goes off with its side. */
    setScreen('stage')
  }
  wasBeside.current = playBeside
  if ((screen === 'notes' && !(twoSidesUp && notesAllowed)) || (screen === STAGE_VIEW && !stageViewAllowed)) {
    /* Notes is a screen only in a side too, and Stage view only for an account that has it: anywhere else each is Play. */
    setScreen('stage')
  }
  /* Wide again: the tool the shrink put away comes back, if Play is still what is showing; gone to Settings meanwhile, it is left for Two sides. */
  useEffect(() => {
    if (!wide) return
    const back = shrunk.current
    shrunk.current = null
    if (back && screen === 'stage') setScreen(back)
  }, [wide])
  /*
   * THE TUNER IN A SIDE (lib/twoSides, step 3; docs/two-sides, "The
   * tuner"). Turned on with two sides up, from Play's button, the list on a
   * bar, the watch or Siri, it borrows the side; or when the window widens
   * with it on. Turned off anywhere, the side is given back to what it
   * borrowed. And its side gone any way at all, folding the Duo too, turns
   * it off at the unit, which it usually mutes (tunerStops).
   */
  const tunerSeen = useRef({ on: tunerOn, wide })
  useEffect(() => {
    const was = tunerSeen.current
    tunerSeen.current = { on: tunerOn, wide }
    if (!tunerOn) {
      if (screen === 'tuner') setScreen(tunerGivesBack(tunerLent.current))
      return
    }
    const came = !was.on || (wide && !was.wide)
    if (came && screen !== 'tuner' && tunerGoes({ allowed: sidesAllowed, wide, screen }) === 'side') {
      /* From a block's knobs, what they had borrowed: the knobs do not come back by themselves. */
      tunerLent.current = sideUnder(screen, { blockLent: blockLent.current })
      setScreen('tuner')
    }
  }, [tunerOn, wide, screen, sidesAllowed])
  const screenWas = useRef(screen)
  useEffect(() => {
    const was = screenWas.current
    screenWas.current = screen
    if (tunerStops({ was, now: screen, tunerOn })) writeTuner(false)
  }, [screen])
  /* Never the big pop-up while two sides can show: the tuner is in its side (docs/two-sides, critic 3). */
  const tunerBeside = wide || (twoSidesUp && sideTool === 'tuner')
  /* What the list under either side's name offers now: the same conditions Play's own buttons use. */
  const toolsOffered = sideTools({
    editOpens,
    presetsOffered: demo || link.link === 'connected',
    tunerOffered: (demo || link.link === 'connected') && caps?.tuner !== false,
    notesOffered: notesOffered({ allowed: notesAllowed, source: sourceFor(rigSlug), lists: listsFor(rigSlug) })
  })
  /* A tool picked from that list, or brought back by Two sides: the tuner by turning it on, which opens its side (above); the rest by their screen. */
  const openTool = (tool) => (tool === 'tuner' ? writeTuner(true) : setScreen(tool))
  const closeSide = () => setScreen('stage')
  /* What the third side's list offers (lib/threeSides thirdTools: the first side's list, less the tool the first has, the tuner and anything Edit's own switch keeps shut), and whether Add a side is offered at all. */
  const thirdToolsOffered = thirdTools({ tools: toolsOffered.filter((t) => t !== 'edit' || BENCH), first: sideTool })
  const thirdCanOpen = thirdOffered({ three, beside: playBeside, first: sideTool, third, tools: thirdToolsOffered })
  const openThirdList = () => setThirdList(true)
  /* The third side goes when what it holds does: Edit's door shut under it, or song notes closed to this account. And its list goes with the room for it. */
  useEffect(() => {
    if ((third === 'edit' && editHere.shuts) || (third === 'notes' && !notesAllowed)) setThird(null)
  }, [third, editHere.shuts, notesAllowed])
  useEffect(() => {
    if (thirdList && !thirdUp && !thirdCanOpen) setThirdList(false)
  }, [thirdList, thirdUp, thirdCanOpen])
  /*
   * WHAT THE TOP BAR CARRIES FOR THE TWO SIDES (`sideLead`), wherever the
   * window shows two (`wide`): on a big screen and on a phone held on its
   * side. "The play and two sides buttons take up a whole row on iPad"
   * (Justin, 10 November 2026), so neither window has a bar over each side
   * any more; their buttons are here (components/SidesLead).
   *
   * With a tool beside Play or filling the window: the two sides' names,
   * Swap and Full screen or Two sides. With Play alone, on a big screen
   * (`big`): Two sides, which brings back the tool that was beside it or,
   * with none yet, opens the list, as Play's own bar did. With Play alone on
   * a phone on its side (`low`): Play's preset and Setlists where Play has
   * sent them up for the height (components/PlayHead), doing what they do
   * on Play. Null on every window that shows one side, for every account
   * the sides are closed to, and off Play: the bar has its version there as
   * always.
   */
  const swapSides = () => {
    keepPlayOnRight(!playOnRight)
    setPlayOnRight(!playOnRight)
  }
  /* The handle on the line (lib/sidesSplit handleOn): a big screen, a tool beside Play, an account it is open to. And the share of the window Play was dragged to, only there. */
  const sideHandle = handleOn({ allowed: tidyAllowed, big, tool: twoSidesUp ? sideTool : null, full: sideFull })
  const sideShare = big ? split.share : null
  /* A side's edge dragged past its least (components/SidesHandle): the tool's lets go as its own Done, Stop tuner or Close would; Play's, and the tool fills the window (never a block's knobs, which never do). */
  const sideLetsGo = (which) => {
    if (which === 'play') return sideTool === BLOCK ? undefined : setSideFull(true)
    return sideTool === 'tuner' ? writeTuner(false) : sideTool === BLOCK ? closeBlock() : closeSide()
  }
  const sideLead = !wide ? null : twoSidesUp ? (
    <SidesLead frame={frame} tool={sideTool} full={sideFull} playOnRight={playOnRight} big={big} onName={setSideList} onSwap={swapSides} onFull={setSideFull} handle={sideHandle} share={sideShare} three={thirdUp ? third : null} onAdd={thirdCanOpen ? openThirdList : null} onThird={openThirdList} />
  ) : low ? (
    screen === 'stage' && playHeadUp ? (
      <PlayHead onOpenPresets={demo || link.link === 'connected' ? () => setScreen('presets') : null} onOpenSetlists={() => setScreen('setlists')} />
    ) : null
  ) : playOnScreen ? (
    <>
      {/* Stage view's way in on a big screen, before Two sides: one press from Play, where the name of a tool sits once a side fills the window. */}
      {stageViewAllowed ? <Press label={STAGE_VIEW_NAME} height={36} labelSize={font.small} onPress={() => setScreen(STAGE_VIEW)} accessibilityLabel="Open Stage view" style={{ paddingHorizontal: space.sm, paddingVertical: 2 }} /> : null}
      <SidesLead big onTwo={sideKept ? () => openTool(sideKept) : () => setSideList('play')} />
    </>
  ) : null
  /* How far along the bar those buttons reach on a big screen (lib/twoSides leadReach), which the bar takes out of the room it offers the account's photo. Nothing on a phone on its side, where the photo gives way to them altogether. */
  const sideLeadWide = big && sideLead ? leadReach({ width: frame?.width, left: frame?.left, right: frame?.right, playOnRight, tool: twoSidesUp ? sideTool : null, full: sideFull, share: sideShare }) : 0
  /* The list goes with what opened it: closed when the window shows one side again (the Duo folded, a phone turned upright), and a side's own list when that side closes. */
  useEffect(() => {
    if (!wide || (sideList === 'tool' && !twoSidesUp)) setSideList(null)
  }, [wide, twoSidesUp, sideList])
  /*
   * DEREK'S IDEA: HOLD A BLOCK, GET ITS PANEL (lib/twoSides, step 4;
   * docs/two-sides, "Derek's idea"; components/BlockSide). Where Edit opens
   * for this unit and connection (`editOpens`, the one rule in lib/editDoor),
   * never on a VP4, and only on a window that shows two sides for an account
   * they are open to, holding a block on Play opens its knobs (`holdOpens`):
   * where the scenes were with Play alone ('lane', drawn by Play itself); in
   * Edit, when Edit is beside Play ('edit': it jumps to the block); or in the
   * side that the tuner, Setlists or All presets had ('side': the screen
   * becomes BLOCK, and what was there is given back on Close). Everywhere
   * else `holdOpens` is null and the hold is the channel pop-up it always was.
   *
   * `blockAt` is the block whose knobs are open, by its effect id, in memory
   * only: nothing opens by itself at launch. It closes when its place goes
   * (`panelKeeps`, by where it was opened, `blockIn`: the window shrunk or
   * the Duo folded, a tool or the tuner taking the side, Play made full
   * screen, Settings, Edit's door shut for good), and when a preset without
   * that block loads (KnobsFollow).
   */
  const [blockAt, setBlockAt] = useState(null)
  /* The block Edit is told to open, with the moment it was held: { eid, at }. */
  const [editJump, setEditJump] = useState(null)
  /* A VP4 has no knobs anywhere, and the demo's VP4 shows its owner what a real one gives (Edit's vp4Bench): no panel on either. */
  const demoUnitNow = useDemoUnit()
  const noKnobs = vp4Here() || (demo && demoUnitNow === 'vp4')
  /* Everyone the two sides are open to, since he tried it (features HOLD_KNOBS_FOR_EVERYONE, 10 November 2026); his account whatever the switches say. */
  const knobsAllowed = sidesAdmin || (sidesAllowed && HOLD_KNOBS_FOR_EVERYONE)
  const holdAsks = { allowed: knobsAllowed, vp4: noKnobs, wide: big, beside: playBeside, screen }
  const holdOpens = holdGoes({ ...holdAsks, editOpens })
  /*
   * AND WHERE THE HOLD IS THE POP-UP, THE POP-UP CARRIES THE BLOCK'S KNOBS
   * OVER ITS CHANNELS (lib/holdPop; components/PopKnobs): "have the knobs
   * only pop up above the channels so some one can quick change a setting"
   * (Justin, 10 November 2026). Behind Edit's own door and never on a VP4.
   * His account until features HOLD_POPUP_KNOBS_FOR_EVERYONE; every other
   * account's pop-up is the channels alone, as it was. Where the hold opens
   * the panel instead (`holdOpens`), no pop-up opens at all.
   */
  const popKnobs = popKnobsOn({ allowed: sidesAdmin || HOLD_POPUP_KNOBS_FOR_EVERYONE, editOpens, vp4: noKnobs })
  /* Open, it stays through a blink of the link: asked with Edit's door not shut, as Edit itself stays (editShut). */
  const blockIn = useRef(null)
  const blockKept = panelKeeps({ screen, goes: holdGoes({ ...holdAsks, editOpens: !editHere.shuts }), opened: blockIn.current })
  const closeBlock = () => {
    setBlockAt(null)
    if (screen === BLOCK) setScreen(blockGivesBack(blockLent.current))
  }
  const holdBlock = (eid) => {
    /* Edit beside Play jumps to the block; so does Edit in the third side (lib/threeSides), whatever the first side holds. */
    if (holdOpens === 'edit' || (holdOpens && thirdEdit)) return setEditJump({ eid, at: Date.now() })
    if (!holdOpens) return undefined
    blockIn.current = holdOpens
    if (holdOpens === 'side' && screen !== BLOCK) {
      /* The side is borrowed: from the tool there, or from what the tuner there had borrowed, since the tuner goes off with its side (tunerStops) and never comes back on by itself. */
      blockLent.current = sideUnder(screen, { tunerLent: tunerLent.current })
      setScreen(BLOCK)
    }
    return setBlockAt(eid)
  }
  useEffect(() => {
    if (blockAt !== null ? !blockKept : screen === BLOCK) closeBlock()
  }, [blockAt, blockKept, screen])
  /* Edit closed: the block it was told to open is forgotten, so it opens on nothing next time, as always. */
  useEffect(() => {
    if (screen !== 'edit' && third !== 'edit') setEditJump(null)
  }, [screen, third])
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
   * AND, WHERE BLUETOOTH IS OFFERED, FROM THE FIRST SECOND: for the top bar's
   * pill, which told somebody who bought the app for an adapter
   * "Disconnected · on your computer" (Justin, 7 November 2026). The same
   * memory and the same once-a-minute limit (lib/useNoComputer.js), asked
   * only of an account this copy offers Bluetooth to, off Bluetooth, with
   * nothing connected. A definite no, and the pill says Not connected · tap
   * to connect and opens the Bluetooth page (TopBar connectFirst). Anything
   * else, and the pill says what it always did.
   */
  const noComputerYet = useNoComputer(auth === 'in' && !demo && !bluetooth && bluetoothOffered && link.link !== 'connected')
  const connectFirst = Boolean(noComputerYet) && bluetoothOffered && !bluetooth && !demo && link.link !== 'connected'
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
   * "HOW DO YOU CONNECT TO YOUR UNIT?" (components/HowConnect): owed once an
   * account is made, a trial started or the full version bought on this
   * device (lib/howConnect), and asked signed in and past the purchase page,
   * not in the demo, where this copy offers Bluetooth (the Settings row's own
   * gate, bluetoothOffered) and nothing is connected yet. Drawn in Play's
   * place, never over it, ahead of the sharing card, and only while Play is
   * the screen (`screen`): never in place of Settings, Troubleshooting, a
   * report being typed or the Bluetooth page. Read from the link as the top
   * bar says it (shownLink), so it does not come and go with a flip. Either
   * answer settles it, and so does a link answering first (the effect
   * below).
   */
  const howOwed = useHowConnectOwed()
  const askHow = howConnectShown({ owed: howOwed, auth, demo, offered: bluetoothOffered, bluetooth, link: shownLink.link, caps, screen })
  /*
   * And settled the moment a real link answers, the computer (a unit behind
   * it or not) or an adapter, or at once when it is asked with one already
   * answering (`howOwed` among the reasons to look): bought from Play's
   * trial line over a live rig, it was owed and then drawn in Play's place
   * at the next drop (the review of 7 November 2026). Never the demo's
   * link, which is still on the render that leaves it (lib/howConnect
   * noteLink).
   */
  useEffect(() => {
    noteLink({ auth, demo, link: link.link, unit: unitHere })
  }, [auth, demo, link.link, unitHere, howOwed])
  /*
   * THE SHARING QUESTION'S MOMENT: signed in and past the purchase page
   * ('in'), and not in the demo, so the App Review demo is never stopped by
   * it. It comes after the independent card and the walkthrough because the
   * branches below put those first; it is drawn in Play's place, never over
   * it. A name, rather than the condition written out where it is drawn.
   *
   * AND ONLY ONCE A UNIT HAS CONNECTED ON THIS DEVICE, at a later launch
   * (connectedBefore): straight after the trial it was one more card between
   * paying and playing, about gear that had not connected yet.
   */
  const askShare = shareDue && connectedBefore && auth === 'in' && !demo
  /*
   * AND ANOTHER SCREEN IS UP IN ITS PLACE, for Siri (lib/siri): a command
   * said there is answered with "Open Play" at once, while one said as the
   * app is still starting waits for Play inside its tap rule. The startup
   * card, the walkthrough, the sign-in, the paywall, How do you connect to
   * your unit? and the sharing card (askHow, askShare) are elsewhere too:
   * Play does not come by itself from any of them (lib/siri-rule
   * playElsewhereOf says which is which).
   */
  /* And not elsewhere while it is beside a tool on two sides (playBeside): Play is showing, so a command is for it, not "Open Play". A tool filling the window over it is the tool's screen, and elsewhere. */
  const playElsewhere = playElsewhereOf({ auth, seenWalk, independentDue, screen: stageViewUp ? 'stage' : screen, shareCard: askHow || askShare }) && !playBeside
  useEffect(() => siriElsewhere(playElsewhere), [playElsewhere])
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
    /* Frosted glass or the classic look (Settings → Colors → Style), from the
       same store. Until it lands it is the glass, the default. */
    hydrate().then(() => loadGlassStyle(sync))
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
    /* And on day 8: the free trial's end (null once it has passed) is the trial's say in it (lib/unlock-rule). */
  }, [auth, demo, purchase.checking, purchase.available, purchase.unlocked, purchase.trialEndsAt])

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
      .then((id) => {
        if (!alive) return
        const open = allowBluetooth(id)
        /* Back to your own rig: on again, as it was before the form (backToRig). Read once, and forgotten. */
        const back = bluetoothBack.current
        bluetoothBack.current = false
        if (open && back) setBluetooth(true)
      })
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
   * AND THE TOP BAR'S PHOTO, for whoever is signed in (lib/accountPhoto): the
   * copy kept on the phone at once, so it shows with no signal, then the
   * account's own from its bucket, at every sign-in and every launch. Read
   * off the phone the way the door reads it (relay.js keptAccount), never the
   * account server, which with no signal answers nobody. Signed out, the
   * circle goes, and the copy with it.
   */
  useEffect(() => {
    if (auth === 'checking') return undefined
    let alive = true
    ;(auth === 'out' ? Promise.resolve(null) : keptAccount())
      .then((who) => alive && showPhotoFor(who))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [auth])

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
             *
             * After a found purchase, the way picked (`way`: No computer -
             * I'll use Bluetooth, or Yes, the computer's) is the answer to
             * How do you connect to your unit?, never asked again once the
             * account is in (lib/howConnect); Bluetooth's goes on to its page
             * (askedBluetooth).
             */
            onAccount={(way) => {
              markWalkthrough()
              setSeenWalk(true)
              setReplaying(false)
              if (way === 'bluetooth' || way === 'computer') howConnectAnswered()
              /* The found purchase's Bluetooth way: on to the Bluetooth page once signed in (askedBluetooth). */
              askedBluetooth.current = way === 'bluetooth'
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
              /* The free trial on Connect my real rig, wherever this copy may offer it (on an iPhone, once the App Store has its free 7-Day Trial item). */
              trial={trialOnOffer(purchase)}
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
                /* The free trial with nobody signed in: out of the walkthrough the same way, onto Create account (toTrialAccount). */
                onMakeAccount={() => {
                  markWalkthrough()
                  setSeenWalk(true)
                  setReplaying(false)
                  toTrialAccount()
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
            /* Somebody who has paid, or is viewing as a new customer, and only came to look (backToRig). The form draws it only while a sign-in is on the phone. */
            onBackToRig={keptForBack && (purchase.unlocked || purchase.posing) ? backToRig : undefined}
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
              /*
               * NOT WHILE HE IS VIEWING AS A NEW CUSTOMER, which puts this
               * page in front of an account that has paid, to be looked at:
               * these two buttons signed him out for real, took the store off
               * his account and wrote his Bluetooth off (3 November 2026).
               * Looking at the page keeps all of it; the banner ends the view.
               */
              if (!purchase.posing) {
                signOut().catch(() => {})
                unlinkAccount().catch(() => {})
                allowBluetooth(null, { signedOut: true })
              }
              setAuth('in')
            }}
            onBack={() => {
              if (!purchase.posing) {
                signOut().catch(() => {})
                unlinkAccount().catch(() => {})
                allowBluetooth(null, { signedOut: true })
              }
              setAuth('out')
            }}
            /* Apple's 5.1.1(v), on the one page an unpaid account can reach:
               the account is gone, so its session goes with it, and the
               store's link to it — a purchase put on a deleted account is
               one nobody can ever sign in to. Not offered while he is only
               viewing as a new customer: it would delete his own. */
            onDeleted={
              purchase.posing
                ? undefined
                : () => {
                    signOut().catch(() => {})
                    unlinkAccount().catch(() => {})
                    allowBluetooth(null, { signedOut: true })
                    setAuth('out')
                  }
            }
          />
        ) : askHow ? (
          /*
           * "How do you connect to your unit?", once, in Play's place
           * (components/HowConnect). Either answer settles it: Bluetooth
           * adapter opens the Bluetooth page, through the Settings row's own
           * gate; No Bluetooth adapter? goes on to Finding your computer…,
           * always, since the card is drawn only while Play is the screen
           * (askHow): there is nothing else behind it to land on.
           */
          <HowConnect
            onBluetooth={bluetoothOffered ? () => (howConnectAnswered(), openSettings('bluetooth')) : null}
            onComputer={howConnectAnswered}
          />
        ) : askShare ? (
          /*
           * "Help make Fractal Remote better?", once, in Play's place. Either
           * button is the answer, and Play comes up as it would have.
           */
          <GearShareNotice
            again={shareDue === 'again'}
            onAnswer={(yes) => {
              setSharing(yes)
              setShareDue(false)
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
              <Press
                label="Viewing as a new customer · tap to stop"
                tone="signal"
                on
                onPress={() => {
                  /* Straight back to his own rig: the demo goes too if the view started it. */
                  poseAsNewCustomer(false)
                  if (!posedInDemo.current) setDemo(false)
                }}
              />
            ) : null}
            <TopBar
              link={shownLink}
              onOpenSettings={() => openSettings()}
              /* The note under the pill, over Bluetooth: back to the screen it was opened over; never over the form (typingReport). */
              onReport={reportBluetooth && !typingReport ? (said) => reportBluetooth(screen, said) : null}
              /* On a USB cable, its note's Use a Bluetooth adapter instead, behind the Bluetooth row's own gate; and the pill itself, while it says Not connected · tap to connect (connectFirst, above). */
              onBluetoothPage={bluetoothOffered ? () => openSettings('bluetooth') : null}
              connectFirst={connectFirst}
              onUnlock={() => setBuying(true)}
              onOpenUnit={() => (unitGoes === 'demo' ? setPickUnit(true) : unitGoes === 'which' ? setPickLive(true) : openSettings('link'))}
              unitGoes={unitGoes}
              /* Edit has its own Save; two on one screen would be one too many. So have a block's knobs, open from a hold (Derek's panel), and so has Edit in the third side (lib/threeSides). */
              saveHere={screen !== 'edit' && blockAt === null && !thirdEdit}
              /* The photo beside the pill: Settings → your account, its sheet open. Not on a phone held on its side while the bar's left holds the two sides' names or Play's preset (`low`, `sideLead`): Settings still has it. A big screen has the room, and keeps it. */
              onOpenAccount={low && sideLead ? null : openAccount}
              /* A phone held on its side (`low`, above): the bar a little shorter over Play and its sides. */
              slim={low && (screen === 'stage' || twoSidesUp)}
              /* The two sides' names, Swap and Full screen or Two sides, wherever the window shows two; or, on a phone on its side, Play's own preset and Setlists where Play has sent them up. On a big screen the version stays in front of them, and the bar is told how far they reach. */
              lead={sideLead}
              leadKeepsVersion={big}
              leadWide={sideLeadWide}
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
              onBluetooth={bluetoothOffered ? () => (setPickLive(false), openSettings('bluetooth')) : null}
            />
            {/* Over the top of whatever is on screen, and gone again on a
                tap. Nothing behind it is being withheld — they came looking
                for this, so Back means back, not out. */}
            {buying ? (
              <Paywall
                asked
                onSignIn={toSignIn}
                onMakeAccount={toTrialAccount}
                onUnlocked={() => setBuying(false)}
                onDemo={() => setBuying(false)}
                onBack={() => setBuying(false)}
              />
            ) : null}
            {picked ? <Arrived picked={picked} /> : null}
            {/* A downloaded update, offered as a restart. Here, in the column,
                on every screen but Play; on Play it floats (below). When the
                app takes it by itself instead, see lib/update-rule.js. */}
            {playOnScreen || stageViewUp ? null : <UpdateReady onWhatsNew={openWhatsNew} />}
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
              list or the stage. The report screen carries its own too, so
              the swipe asks "Not sent yet" the way its Back button does.

              `null` on the stage screen itself: there is nowhere behind it,
              and a gesture that does nothing is worse than none at all.
            */}
            <EdgeBack onBack={backFrom}>
            {/* The frame under the top bar, measured for the two sides (his account only): nothing drawn, nothing moved. */}
            {sidesAllowed ? <SidesFrame onFrame={setFrame} /> : null}
            {settling && screen === 'stage' ? (
              <Waking
                link={link}
                long={lookedLong}
                onRetry={probeNow}
                onSwitch={() => openSettings('link')}
                onTroubleshoot={openConnectFix}
                onBluetooth={bluetoothOffered ? () => openSettings('bluetooth') : null}
                onReport={reportBluetooth ? (said) => reportBluetooth('stage', said) : null}
              />
            ) : alone === 'presets' ? (
              <Presets onBack={() => setScreen('stage')} />
            ) : alone === 'setlists' ? (
              <Setlists onBack={() => setScreen('stage')} notes={notesAllowed} />
            ) : BENCH && alone === 'edit' ? (
              <Edit
                onBack={() => setScreen('stage')}
                onOpenGear={() => {
                  setGearBack('edit')
                  setScreen('gear')
                }}
              />
            ) : screen === 'connect' ? (
              <Connect onBack={() => setScreen('settings')} onBluetooth={bluetoothOffered ? () => openSettings('bluetooth') : null} />
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
               * Leave feedback or report a problem, however it was opened.
               * From a Bluetooth place, through the page's own gate again in
               * case that changed since, it carries the Bluetooth lines in its
               * log's head and the fault line it was opened from.
               */
              <Report
                onBack={() => setScreen(reportFrom)}
                bluetooth={reportAbout === 'bluetooth' && bluetoothOffered}
                said={reportAbout === 'bluetooth' && bluetoothOffered ? reportSaid : null}
              />
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
                openAccountSheet={accountSheet}
                onAccountSheet={() => setAccountSheet(false)}
                /* Stage view's row under Play screen, for an account that has it. */
                onStageView={stageViewAllowed ? () => setScreen(STAGE_VIEW) : null}
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
                  /* Where he was when the view began: started again while it is on, the first start's answer stands. */
                  if (!purchase.posing) posedInDemo.current = demo
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
              /*
               * Play, in the host that gives it a side (components/Sides). For
               * everybody but his account the host draws Play and nothing
               * else; for his, on a window wide enough, the tool the switch
               * above left to it (twoSidesUp) is drawn beside Play, or over
               * it when it fills the window. Their names, Swap and Full
               * screen are in the app's top bar (`sideLead`, above).
               */
              <Sides
                allowed={sidesAllowed}
                two={wide}
                tool={twoSidesUp ? sideTool : null}
                full={sideFull}
                playOnRight={playOnRight}
                frame={frame}
                tools={toolsOffered}
                onPick={openTool}
                /* The list of what goes beside Play, opened from a side's name in the top bar (`sideLead`, above). */
                list={sideList}
                onList={setSideList}
                /* The handle on the line between the sides, where it is open (`sideHandle`, above): swap, resize, let a side go. */
                handle={sideHandle}
                share={sideShare}
                onSwap={swapSides}
                onSplitReset={split.reset}
                onShare={split.set}
                onLetGo={sideLetsGo}
                /* The third side, where the window has room for three and one is open (`thirdUp`, above): its tool, its own list, and what the list does. */
                three={three}
                third={thirdUp ? third : null}
                thirdTools={thirdToolsOffered}
                thirdList={thirdList}
                onThirdList={setThirdList}
                onPickThird={setThird}
                onCloseThird={closeThird}
                thirdSide={
                  !thirdUp ? null : third === 'presets' ? (
                    <Presets onBack={closeThird} stay />
                  ) : third === 'setlists' ? (
                    <Setlists onBack={closeThird} notes={notesAllowed} />
                  ) : third === 'notes' ? (
                    <NotesSide onBack={closeThird} />
                  ) : (
                    <Edit
                      onBack={closeThird}
                      jump={editJump}
                      onOpenGear={() => {
                        setGearBack('edit')
                        setScreen('gear')
                      }}
                      beside
                    />
                  )
                }
                side={
                  !twoSidesUp ? null : sideTool === 'presets' ? (
                    /* Beside Play the list stays open after a pick (`stay`), so you can keep browsing while the rig plays it. */
                    <Presets onBack={closeSide} stay />
                  ) : sideTool === 'setlists' ? (
                    <Setlists onBack={closeSide} notes={notesAllowed} />
                  ) : sideTool === 'notes' ? (
                    /* The setlist song's lyrics, chords or cues, following the song as Play steps. */
                    <NotesSide onBack={closeSide} />
                  ) : sideTool === 'tuner' ? (
                    /* Stop tuner turns it off, and the side closes with it. */
                    <TunerSide onClose={() => writeTuner(false)} down={link.down === true && !demo} />
                  ) : sideTool === BLOCK ? (
                    /* A block held on Play: its knobs, in the side it borrowed; Close gives the side back. */
                    blockAt !== null ? <BlockSide eid={blockAt} onClose={closeBlock} /> : null
                  ) : (
                    <Edit
                      onBack={closeSide}
                      /* A block held on Play with Edit beside it: Edit jumps to it. */
                      jump={editJump}
                      onOpenGear={() => {
                        setGearBack('edit')
                        setScreen('gear')
                      }}
                      /* Beside Play, not filling the window: the tidier Edit leaves the preset's name to Play there. */
                      beside={playBeside}
                    />
                  )
                }
              >
              <Stage
                /* On one side of two, and asleep while a tool fills the window over it (components/Sides). */
                inSide={playBeside}
                awake={!playHidden}
                tunerBeside={tunerBeside}
                /* A phone held on its side, for an account that is open to (above): two halves of square tiles. False everywhere else. */
                low={low}
                /* Where holding a block opens its knobs, and the block whose knobs are open where the scenes were, for as long as that is their place (Derek's panel, above). */
                holdOpens={holdOpens}
                knobsAt={blockKept && screen === 'stage' ? blockAt : null}
                onHoldBlock={holdBlock}
                onCloseKnobs={closeBlock}
                /* Where the hold is the channel pop-up, whether the block's knobs sit over the channels in it (above). */
                popKnobs={popKnobs}
                /* Stage view: Play drawn large over itself, with Play's own presses under every button; and whether its Notes button is offered. */
                stageView={stageViewUp}
                onCloseStageView={() => setScreen('stage')}
                songNotes={notesAllowed}
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
                /* The bench where it opens; where it is built and not open over Bluetooth or a cable, the same button saying why (editOpens, editExplained, above). */
                onOpenEdit={editOpens ? () => setScreen('edit') : editExplained ? () => setEditWhyAt(Date.now()) : null}
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
              </Sides>
            )}
            {/* Over the play screen and never in it, where the fault floats,
                and out of the way while the fault or the advice is up. */}
            {readyOverPlay ? <UpdateReady over onWhatsNew={openWhatsNew} /> : null}
            {/* A look just applied in Settings → Colors: "Now: Sunlight · Undo" for a
                moment over Play, which Apply comes back to (components/Colours). */}
            {playOnScreen ? <LookUndo /> : null}
            {/* A unit just plugged in by USB cable: the offer to use it, or the switch made by itself (components/CablePlugIn). */}
            {playOnScreen ? <CablePlugIn /> : null}
            {/* Play's Edit tapped where Edit does not open over Bluetooth or a cable: why, in one line (editExplained, above). */}
            {playOnScreen && editExplained ? <EditWhy at={editWhyAt} cable={cableNow} onDismiss={() => setEditWhyAt(0)} /> : null}
            {/* An open panel follows its block to the next preset, or closes when that preset has not got it. Draws nothing. */}
            {blockAt !== null ? <KnobsFollow eid={blockAt} onClose={closeBlock} /> : null}
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
const ofTunerOn = (s) => s.tunerOn
/* The gate's answer from the unit (readFailed, above): a failed read, or the computer saying it has no unit. */
const ofReadEnded = (s) => s.error || (s.unit === 'missing' ? 'no unit' : null)

/*
 * How long Look for the computer again says Looking… before it says nothing
 * answered: past one round of asking, which goes at once (lib/link.js
 * probeNow), and a computer that answers takes the waiting screen away first.
 */
const RETRY_SHOWN_MS = 4000

/**
 * LOOK FOR THE COMPUTER AGAIN, SEEN TO DO SOMETHING. "Tapping look for
 * computer again seemingly does nothing when it's already looking" (Justin,
 * 7 November 2026). It asks at once (probeNow), and a computer that answers
 * takes the waiting screen away; one that does not changed nothing on screen.
 * So the button says Looking… for a few seconds, and then, still unanswered,
 * says so under it. Its own timer, out here and never Waking's: the waiting
 * screen keeps no clock (useLookedLong is the fifteen seconds), and the
 * advice stays up through it.
 */
function LookAgain({ onRetry }) {
  const [asked, setAsked] = useState(null)
  useEffect(() => {
    if (asked !== 'asking') return undefined
    const t = setTimeout(() => setAsked('unanswered'), RETRY_SHOWN_MS)
    return () => clearTimeout(t)
  }, [asked])
  return (
    <>
      <Press
        label={asked === 'asking' ? 'Looking…' : 'Look for the computer again'}
        disabled={asked === 'asking'}
        onPress={() => {
          setAsked('asking')
          onRetry?.()
        }}
      />
      {asked === 'unanswered' ? (
        <Text style={{ color: color.silkDim, fontSize: font.small, textAlign: 'center' }}>
          No answer from the computer yet. It keeps looking by itself.
        </Text>
      ) : null}
    </>
  )
}

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
function Waking({ link, long, onRetry, onSwitch, onTroubleshoot, onBluetooth, onReport }) {
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
  /* A unit on a USB cable (lib/bleAdapters isCable): no adapter, no Bluetooth to switch on, so the line and Look again say the cable and the unit. */
  const cableKept = useCableNow()
  const cable = bluetooth && cableKept
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
   * the last button off the bottom.
   */
  return (
    <ScrollView
      accessibilityLiveRegion="polite"
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl }}
    >
      {/*
        BLUETOOTH FIRST, FROM THE FIRST SECOND. "I think most people are gonna
        opt for Bluetooth, probably 90%. So we need to make that the most
        prominent thing" (Justin, 7 November 2026). It came after fifteen
        seconds, third, under Look for the computer again, and never under
        the account warning, so a new customer with a computer on another
        account in the house was never offered it at all (his report that
        day). Now it is the first thing here, the Bluetooth page's own Connect
        look (its symbol, its blue), for whoever App hands a way in
        (`onBluetooth`: the Settings row's own gate), while Bluetooth is off
        and until the computer answers (then the unit is being asked what it
        is, and there is nothing to choose). It only opens the page: nothing
        touches the phone's Bluetooth before Connect there.
      */}
      {!bluetooth && onBluetooth && link.link !== 'connected' ? (
        <Press
          label="Connect over Bluetooth"
          sub={BLUETOOTH_WAYS_SHORT}
          icon={bluetoothIcon}
          inkColor={color.ble}
          labelSize={font.lead}
          height={64}
          tone="live"
          style={{ alignSelf: 'stretch' }}
          onPress={onBluetooth}
        />
      ) : null}
      <ActivityIndicator color={color.silkDim} />
      <Text style={{ color: color.silkDim, fontSize: font.body, textAlign: 'center' }}>{said}</Text>
      {/* Not over "No computer is signed in with this account yet", which
          names the account already: beside it, "make sure you're connected"
          is about a computer that is not there. Nor over the account
          warning, which names it too (report of 7 November 2026: the same
          email twice, one under the other). And only once the computer has
          been looked for a while: from the first second it was one more line
          about a computer, read first by somebody who has none. */}
      {long && email && link.link !== 'connected' && !bluetooth && !noneSaid && !elsewhere ? (
        <Text style={{ color: color.silkFaint, fontSize: font.small, textAlign: 'center' }}>
          {'Make sure you’re connected to your computer using '}
          <Text style={{ color: color.silkDim, fontWeight: '700' }}>{email}</Text>.
        </Text>
      ) : null}
      {/*
        THE WAY BACK TO THE COMPUTER, FROM THE FIRST SECOND. "How do I get out
        of Bluetooth mode so I can go back to connecting to computer?" (10
        October 2026, on this screen, with the adapter not there.) The only
        way was the gear, Phone & computer, Bluetooth, Stop — four
        taps from a screen that offered nothing for fifteen seconds and then
        only a way to look again. Turning Bluetooth off is what Stop does,
        and the link starts looking for the computer the moment it is off.
      */}
      {bluetooth ? (
        <View style={{ alignSelf: 'stretch' }}>
          <Press label="Use the computer instead" onPress={() => setBluetooth(false)} />
          {/* On a USB cable, a Bluetooth adapter too (lib/cableWords CABLE_TO_ADAPTER): the one from before the cable, or the page to connect one. */}
          {cable && onBluetooth ? (
            <Press label={CABLE_TO_ADAPTER} sub={CABLE_TO_ADAPTER_SUB} style={{ marginTop: space.sm }} onPress={() => adapterInsteadOfCable({ byHand: true }) || onBluetooth()} />
          ) : null}
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
                    : cable
                      ? CABLE_WAITING
                      : `Check the ${deviceNoun()}’s Bluetooth is on, that the adapter is plugged into the unit’s MIDI In and Out and lit, and that nothing else is connected to it.`}
            </Note>
          ) : elsewhere ? (
            <Note tone="fault">
              {email
                ? `The computer on this wifi is signed into a different account. Sign it in as ${email}, or switch this ${deviceNoun()} to its account.`
                : `The computer on this wifi is signed into a different account than this ${deviceNoun()}. Sign both into the same account.`}
            </Note>
          ) : noneSaid ? (
            <Note tone="warn">
              <NoComputerWords email={noComputer.email} />
            </Note>
          ) : (
            <Note tone="warn">
              Open the Fractal Remote app on the computer, and check the computer is awake.
            </Note>
          )}
          {/* Android's own question to turn it on (lib/bluetooth turnOnBluetooth), under the note that says it is off: the link connects the moment it is on. */}
          {bluetooth && trouble === 'bluetooth-off' ? <Press label="Turn on Bluetooth" tone="live" onPress={() => turnOnBluetooth()} /> : null}
          {/*
            AND THE LINK, TO THEIR INBOX, right under the words that say no
            computer was ever set up. "Add a 'Send me the download link'
            button on the three screens where they get stuck" (15 October
            2026). To the account's own address, the one the words name.
          */}
          {noneSaid ? <SendLinkButton email={noComputer.email} /> : null}
          {/* Not the no-computer note's Bluetooth line here
              (components/NoComputer.js NoComputerOtherWay), which Phone &
              computer draws: this screen has its own way to Bluetooth, the
              button at the top. Both together were the same pitch twice, the
              note sending them the long way round to the page the button
              opens in one tap. */}
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
              label={cable ? CABLE_LOOK_AGAIN : 'Look for the adapter again'}
              sub={opensApplesScreen() ? APPLE_SCREEN_OPENS : undefined}
              onPress={() => lookForAdapterAgain(onRetry)}
            />
          ) : (
            <LookAgain onRetry={onRetry} />
          )}
          {/* Over Bluetooth the adapter's own page, where it is found and
              its status is; the computer's troubleshooting is about a
              computer that is not in use. */}
          {bluetooth && onBluetooth ? <Press label="Bluetooth" onPress={onBluetooth} /> : null}
          {/*
            REPORT A BLUETOOTH PROBLEM, where a stuck player actually sits:
            fifteen seconds of Finding the adapter, over Bluetooth only. The
            line it was stuck on goes with it. Handed only through the page's
            own gate (App's reportBluetooth).
          */}
          {bluetooth && onReport ? <Press label={REPORT_BUTTON} onPress={() => onReport(said)} /> : null}
          {/* "Open the troubleshooting if it doesn't connect" — the browser's
              connecting screen has the same button. */}
          {onTroubleshoot && !bluetooth ? <Press label="Troubleshooting" onPress={onTroubleshoot} /> : null}
          {/*
            NO SETLISTS HERE since 7 November 2026: "I don't know the purpose
            of having set lists on a screen when you're not connected at all
            ... it shouldn't be on a connect screen." They are on Play, and in
            the demo.
          */}
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
