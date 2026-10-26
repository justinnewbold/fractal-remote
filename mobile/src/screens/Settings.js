import { useEffect, useRef, useState } from 'react'
import { Alert, BackHandler, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native'

import { color, font, mono, radius, space, TAP, MODES, getMode, setMode } from '../lib/theme'
import { APP_VERSION } from '../lib/version'
import { AFFILIATION, SUPPORT_LINE, SUPPORT_URL } from '../lib/affiliation'
import { setDemo, useDemo, useDemoUnit, setDemoUnit } from '../lib/demo'
import { UNITS as DEMO_UNITS, demoSentence } from '../lib/demoUnits'
import { getDebugLog } from '../lib/debugLog'
import { tick } from '../lib/feedback'
import { NOT_ACROSS, NOT_ACROSS_SIGNED_OUT, ONLY_HERE, unlockedFrom, usePurchase } from '../lib/purchases'
import { applyNow, checkNow, describeRunning, useUpdates } from '../lib/updates'
import { openStore, useStoreNote } from '../lib/storeVersion'
import NewerInStore from '../components/NewerInStore'
import {
  changePassword,
  currentAccount,
  deleteAccount,
  hostConflict,
  keptAccount,
  remoteChosenHost,
  remoteHosts,
  remoteMissingPick,
  remoteUnits,
  sendPasswordReset,
  unitChoices
} from '../lib/relay'
import { askUnknownUnits, chooseHost, forgetMissing } from '../lib/link'
import MissingPick from '../components/MissingPick'
import { notUsingOne } from '../lib/relay-rules'
import { useRig } from '../lib/rig'
import { setFlashTiming, setMetronome, useFlashTiming, useMetronome, useUnitHeardOn } from '../lib/metronome'
import { FLASH_NUDGE, clicks, flashTimingNote, metronomeNote, nudgeFloor, placeLit, placesFor, unitClick } from '../lib/metronome-rules'
import { fcReadable } from '../lib/footswitches'
import Footswitches from '../components/Footswitches'
import Colours, { LookUndo } from '../components/Colours'
import { coloursStatus } from '../lib/colourPage'
import {
  SIZES,
  clampSize,
  loadFit,
  loadIcons,
  loadSceneLayout,
  loadSceneOrder,
  loadSize,
  saveFit,
  saveIcons,
  saveSceneLayout,
  saveSceneOrder,
  saveSize,
  SCENE_LAYOUTS
} from '../lib/gigSize'
import { REPLAY } from '../lib/onboarding'
import { sync, useStored } from '../lib/store'
import { isPairAccount } from '../lib/pairing'
import { mayDrive, mayDriveBluetooth } from '../lib/unlock-rule'
import { useComputerElsewhere } from '../lib/useComputerElsewhere'
import NoComputerWords, { NoComputerOtherWay } from '../components/NoComputer'
import SendLinkButton from '../components/SendLinkButton'
import { quitEditor } from '../lib/editors'
import { isAdmin } from '../lib/admin'
import { watchHow, watchPaired, watchSupported } from '../lib/watchBridge'
import { useSiriLinksOpen } from '../lib/siri'
import { siriRow } from '../lib/siri-help'
import { siriPresent } from '../lib/siriPipe'
import SiriHelp from '../components/SiriHelp'
import { APPLE_SCREEN_OPENS, bluetoothSupported, lookForAdapterAgain, opensApplesScreen, useBluetoothAdmin, useBluetoothAllowed, useBluetoothOn } from '../lib/bluetooth'
import { BLUETOOTH_ROW_OFF, BLUETOOTH_WAYS } from '../lib/bluetooth-gear'
import { overBluetooth } from '../lib/bleSwitch'
import BluetoothPage from './Bluetooth'
import AccessTool from '../components/AccessTool'
import AccountsTool from '../components/AccountsTool'
import SalesTool from '../components/SalesTool'
import MessagesTool from '../components/MessagesTool'
import LiveTool from '../components/LiveTool'
import UsageTool from '../components/UsageTool'
import StuckTool from '../components/StuckTool'
import Lamp from '../components/Lamp'
import { ChainCards, TipCard } from '../components/Walk'
import { linkChain } from '../lib/link-chain'
import { UPDATE_STEPS } from '../lib/computer-update'
import { DOWNLOADS_URL } from '../lib/downloadLink'
import CopyAddress, { breakableAddress } from '../components/CopyAddress'
import playIcon from '../../assets/icons/play.png'
import laptopIcon from '../../assets/icons/laptop.png'
import mailIcon from '../../assets/icons/mail.png'
import phoneIcon from '../../assets/icons/phone.png'
import sendIcon from '../../assets/icons/send.png'
import setupIcon from '../../assets/icons/setup.png'
import Note from '../components/Note'
import PasswordBox from '../components/PasswordBox'
import Press from '../components/Press'
import { stopLooper } from '../components/Looper'
import Vp4Setup from '../components/Vp4Setup'
import { vp4Here } from '../lib/device'
import { MIDI_SETUP_TITLE, VP4_SETUP, readVp4Setup, vp4ComputerLacks, vp4SetupStatus } from '../lib/vp4-safety'
import { findLooper } from '../lib/looper'
import SceneArrange from '../components/SceneArrange'
import EdgeBack from '../components/EdgeBack'
import Sheet from '../components/Sheet'
import { deviceKind, deviceNoun, pairTitle } from '../lib/device-word'

/* "Phone & computer", or "iPad & computer" on an iPad (device-word.mjs). Read
   once: App.js says which device this is before this file is loaded. */
const PAIR_TITLE = pairTitle()

/* "Siri" on an iPhone or iPad, "Links for Tasker" on Android (lib/siri-help): a row's name, as PAIR_TITLE is one. */
const SIRI_TITLE = siriRow({ os: Platform.OS }).title

const face = Platform.select(mono)

const ofDeviceName = (s) => s.deviceName
const ofFirmware = (s) => s.firmware

const ofUnitState = (s) => s.unit
const ofAllBlocks = (s) => s.allBlocks
const ofCapabilities = (s) => s.capabilities

/**
 * Everything that isn't playing.
 *
 * Folded off the stage screen on purpose: which Mac, which account, and a new
 * password are all things done about once, and none of them should be within
 * reach of a thumb that is looking for the next scene.
 */
/* The sections below that write to the unit are the ones the browser keeps
   under "Unit" in its own Setup: renaming is bench work, not something a thumb
   crosses between songs, which is exactly why neither app puts it on Play. */
export default function Settings({
  onUnlock,
  onOpenConnect,
  link,
  /* No computer has ever signed in with this account, for certain: the
     email to name, or null (App's useNoComputer). */
  noComputer = null,
  macName,
  hostVersion,
  onBack,
  onReconnect,
  onSignOut,
  onOpenGear,
  onReplay,
  onViewAsCustomer,
  onOpenLog,
  onOpenFixes,
  onOpenReport,
  /* Report a Bluetooth problem, from the Bluetooth page: App's own, through the page's gate, or null. */
  onReportBluetooth = null,
  onSignIn,
  /* Making an account, for a phone whose purchase is on no account yet. */
  onMakeAccount,
  /* The page to open on, and who to tell when it changes — see App.js's
     openSettings. */
  startPage = null,
  onPage
}) {
  const deviceName = useRig(ofDeviceName)
  const firmware = useRig(ofFirmware)
  const unitState = useRig(ofUnitState)
  const [account, setAccount] = useState(null)
  /* A computer on this wifi signed into another account — the likeliest
     reason nothing answers, and until now one nothing on this page could see. */
  const elsewhere = useComputerElsewhere(link === 'no-answer')
  /*
   * And "No computer is signed in with this account yet" in place of "make
   * sure the computer is awake", once the account server has said so for
   * certain and the account warning has had its answer and it was no.
   */
  const noneSaid = link === 'no-answer' && Boolean(noComputer) && elsewhere === false
  /*
   * Whether the account service has answered yet.
   *
   * `account` is null both before the question is asked and when nobody is
   * signed in, and those are opposite answers. Without this the line below
   * has to guess during the first frame, and the old code guessed "Signed
   * in." — which is how a demo with no session at all came to say it was
   * signed in.
   */
  const [asked, setAsked] = useState(false)
  /*
   * AND WHOSE SIGN-IN THIS PHONE STILL HOLDS, when the account service has
   * not vouched for one: no signal at a gig, a sign-in past its hour that
   * could not be renewed, or the first seconds before the service answers.
   *
   * The door lets a customer in on that sign-in (relay.js keptSession), and
   * this page used to call them "Not signed in" beside "Full version", and
   * offer "Sign in with an email and password": a form that cannot work with
   * no signal, which they could only leave by Try the Demo or by closing the
   * app — and which, on Justin's phone, wrote his Bluetooth off on the way.
   * So it says the email, and that what needs the internet comes back with
   * it. Kept APART from `account`, which stays the account service's answer:
   * Delete account and the password sheet still need it, because both ask
   * the account service, and neither can be done offline.
   *
   * Read at once, off the phone, so the email is up while the service is
   * asked (up to twenty-five seconds of supabase-js's retries with no
   * signal), and read again when the service says nobody, because a sign-in
   * it turned away has been taken off the phone by then.
   */
  const [kept, setKept] = useState(null)
  const keptHere = account ? null : kept
  const keptEmail = keptHere?.email && !isPairAccount(keptHere.email) ? keptHere.email : null
  const [leaving, setLeaving] = useState(false)
  const [hosts, setHosts] = useState(remoteHosts())
  const [chosen, setChosen] = useState(remoteChosenHost())
  const [units, setUnits] = useState(remoteUnits())
  /* While a computer that has not said its unit is asked again (link.js askUnknownUnits). */
  const [unitsAsking, setUnitsAsking] = useState(false)
  const [missing, setMissing] = useState(remoteMissingPick())
  /*
   * The account line opens a small sheet of the things done about once —
   * change the password, or have a reset link sent. "Change it to where the
   * box isn't just showing New password": it sat open on this page for
   * everyone who came to change the tile size.
   */
  const [accountMenu, setAccountMenu] = useState(false)
  /* A scene being dragged on the Appearance page holds the page still — see
     components/SceneArrange. */
  const [held, setHeld] = useState(false)
  /* The account's email, when there is a real one: a pairing code's account
     is not somebody's email and is not called one. */
  const signedInAs = account?.email && !isPairAccount(account.email) ? account.email : null
  const [changing, setChanging] = useState(false)
  /* Delete account: Apple's 5.1.1(v). A sheet that says what goes, then one
     more tap — never one tap from the page. */
  const [deleting, setDeleting] = useState(false)
  /* Where the full version came from, asked as the sheet opens: what
     deleting costs depends on it (purchases.js, unlockedFrom). */
  const [from, setFrom] = useState(null)
  useEffect(() => {
    if (!deleting) return undefined
    let alive = true
    unlockedFrom().then((store) => alive && setFrom(store))
    return () => {
      alive = false
    }
  }, [deleting])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    /* The second read is the one that counts, if the first is somehow the later. */
    let reread = false
    keptAccount()
      .then((k) => alive && !reread && setKept(k))
      .catch(() => {})
    currentAccount()
      .then(async (a) => {
        if (!alive) return
        setAccount(a)
        if (a) return
        reread = true
        const k = await keptAccount().catch(() => null)
        if (alive) setKept(k)
      })
      .catch(() => {})
      .finally(() => alive && setAsked(true))
    return () => {
      alive = false
    }
  }, [])

  /* Again on opening a page: the roll call finishes a few seconds after the
     link does, so the list can arrive while nothing about the link changes. */
  useEffect(() => {
    setHosts(remoteHosts())
    setChosen(remoteChosenHost())
    setUnits(remoteUnits())
    setMissing(remoteMissingPick())
  }, [link, page])

  /* Which unit on screen: a computer that has not said its unit is asked again, with longer. */
  useEffect(() => {
    if (page !== 'link' || remoteHosts().length < 2) return undefined
    let alive = true
    const unknown = remoteHosts().some((name) => !remoteUnits()[name])
    if (unknown) setUnitsAsking(true)
    askUnknownUnits().finally(() => {
      if (!alive) return
      setUnitsAsking(false)
      setUnits(remoteUnits())
    })
    return () => {
      alive = false
    }
  }, [link, page])

  const conflict = hostConflict(hosts, chosen)
  const clickSetting = useMetronome()
  const rigSlug = useRig((s) => s.deviceSlug)
  const rigBpm = useRig((s) => s.bpm)
  const [clickSaid, setClickSaid] = useState(null)
  const changeClick = async (patch) => {
    setClickSaid(null)
    const said = await setMetronome(patch, rigSlug, clickHere)
    if (said?.ok === false && !said?.unsupported) setClickSaid('The unit didn’t take it. Check it’s connected, then try again.')
  }
  /* What the Stop the looper row last did, in words, in place of its hint. */
  const allBlocks = useRig(ofAllBlocks)
  /* A unit whose switches can be read — see the Footswitches page. */
  const caps = useRig(ofCapabilities)
  const switchesReadable = fcReadable(caps)
  /* A real VP4, on the computer or over Bluetooth (not the demo's): it gets the Scene Select card, whose number and channel both ways send. Read again on every change to the rig or to storage. */
  useStored()
  const onRealVp4 = vp4Here()
  /* Bluetooth (beta): whether the phone is talking to the unit itself. */
  const bluetooth = useBluetoothOn()
  /*
   * And whether it is open to the account signed in here at all: Justin's on
   * every copy, and anybody else's only on a copy whose built-in store
   * version opens it, which no copy today does (lib/bluetooth.js
   * allowBluetooth, and lib/ble-rule.js). Decided in App.js from the session
   * kept on the phone rather than from `account` above: that one asks the
   * account server, and Bluetooth is for playing where there may be no
   * signal. A row that vanished offline would take the page, and its Stop
   * button, with it while Bluetooth was still on.
   */
  const bluetoothAllowed = useBluetoothAllowed()
  /*
   * AND THE FULL VERSION, AS BLUETOOTH READS IT (unlock-rule mayDriveBluetooth):
   * the purchase itself for a customer, the one remembered on the phone
   * included, never "the store cannot be reached", which mayDrive takes as a
   * yes and which no signal always is; mayDrive's answer for his account.
   */
  const bluetoothAdmin = useBluetoothAdmin()
  /*
   * SETTINGS → SIRI, where the links are open (lib/siri useSiriLinksOpen):
   * on an iPhone or iPad whose copy has the Siri phrases, on Android from
   * the store version after 1.87.11, and on Justin's account anywhere. That
   * gate is a fact about the copy of the app, never a switch an update can
   * flip (lib/siri-rule linksOpen), so the page cannot reach customers on a
   * store version whose review notes do not describe it. Which page is
   * lib/siri-help's: the phrases where this copy has them (siriPresent),
   * the links where it does not, and the links for Tasker on Android.
   */
  const siriOpen = useSiriLinksOpen()
  const siriNative = siriPresent()
  const siriStatus = siriRow({ os: Platform.OS, native: siriNative }).status
  const [looperSaid, setLooperSaid] = useState(null)
  async function stopTheLooper() {
    const looper = findLooper(allBlocks)
    if (!looper) {
      setLooperSaid('This preset has no looper, so nothing is looping')
      return
    }
    setLooperSaid('Stopping…')
    try {
      await stopLooper(looper.effectId)
      setLooperSaid('Stopped')
    } catch (e) {
      setLooperSaid(`Didn’t stop — ${e?.message || 'the unit did not answer'}`)
    }
  }

  const unitDown = link === 'connected' && (unitState === 'missing' || unitState === 'silent')
  const lamp = unitDown ? 'fault' : link === 'connected' ? 'live' : link === 'no-answer' ? 'fault' : 'idle'

  /**
   * Which page of Setup is open, or null for the list of them.
   *
   * SETUP IS A LIST OF DOORS, not a scroll of everything at once. That is the
   * browser's shape and it was arrived at the hard way — "I wanna overhaul this
   * whole settings set-up screen" — and the phone had the pile it replaced, with
   * eight scene-name boxes as the FIRST thing you saw. Nobody opens Setup to
   * rename scene 6.
   *
   * Each row carries the one fact you would have opened it to learn: which unit
   * and whether it answers, which Mac the phone is on, what size the tiles are.
   */
  const demo = useDemo()
  /* Where the unit's own click can be switched from here: not over Bluetooth, not on an AM4, not in the demo. */
  const clickHere = { bluetooth: bluetooth && !demo, demo }
  const unitCan = unitClick(rigSlug, clickHere)
  /* And whether the unit has said its click is on: until it does, the phone keeps time under Unit too. */
  const clickHeard = useUnitHeardOn(rigSlug)
  /* Flash timing, offered wherever the phone's own click can be the one that sounds. */
  const flashTiming = useFlashTiming()
  const phoneMayClick = clicks({ ...clickSetting, on: true }, unitCan.can, clickHeard).phone
  /* Which one, and told when it changes. Read as `demoUnit()` this never
     redrew, so the five buttons stayed lit on whichever unit the app started
     as however many times they were pressed. */
  const unit = useDemoUnit()
  /* Bluetooth (beta) with no demo: no computer in the chain. bleLink puts the
     adapter's name where the computer's goes (macName), and never a version. */
  const throughAdapter = bluetooth && !demo

  const [page, setPage] = useState(startPage)
  useEffect(() => {
    onPage?.(page)
  }, [page, onPage])
  /*
   * EVERY PAGE OPENS AT ITS TOP. One scroll holds every page here, so a page
   * opened from a row far down Settings opened as far down itself: Colours,
   * from near the bottom of the list, came up with its title, its way back
   * and its first heading above the screen. Going back up a page returns to
   * where its row was, so the list is not read from the top again.
   */
  const scroller = useRef(null)
  const offsets = useRef({})
  const lastPage = useRef(page)
  useEffect(() => {
    const from = lastPage.current
    lastPage.current = page
    if (from === page) return
    const up = upFrom(from) === page
    scroller.current?.scrollTo({ y: up ? offsets.current[page ?? ''] || 0 : 0, animated: false })
  }, [page])
  const purchase = usePurchase()
  const updates = useUpdates()
  /* This phone's copy older than the store's: the card at the top, once, and the line under Updates. See lib/store-rule.js. */
  const newer = useStoreNote()
  /* Which bundle is running, asked once when Setup opens. It settles "did an
     update ever land" without anybody comparing numbers off two screens. */
  useEffect(() => {
    describeRunning()
  }, [])

  const linkWord =
    link === 'connected'
      ? `Connected to ${macName || 'your computer'}`
      : link === 'joining'
        ? 'Finding your computer'
        : link === 'no-answer'
          ? 'Your computer isn’t answering'
          : 'Not connected'
  /* Over Bluetooth (beta) the row is about the adapter on the unit, not a computer. */
  const bluetoothWord =
    link === 'connected'
      ? unitState === 'missing' || unitState === 'silent'
        ? `Bluetooth · ${deviceName || 'unit'} not answering`
        : `${deviceName || 'Unit'} · Bluetooth`
      : link === 'joining'
        ? 'Bluetooth · looking for the adapter'
        : 'Bluetooth · not connected'

  /*
   * TWO WAYS OUT OF EVERY PAGE, and they go to different places on purpose.
   *
   * "Add the done button to all submenus, and if they click done, it takes
   * them directly back to the play screen, no matter how deep they are in the
   * submenus. Swiping back should always take them to the previous screen."
   *
   * Back is one step — a submenu to the list, the list to Play. Done is the
   * whole way out from any depth. A submenu had only Back, so leaving from
   * three levels in meant tapping out one level at a time; the list had only
   * Done, so there was no step back from it at all. Both now have both.
   *
   * The submenu head is two rows rather than three things crammed across one:
   * Back and Done on the top, the title under them with the width to itself.
   * "Rename presets and scenes" is four words that will not share a line with
   * two buttons on a phone.
   */
  /*
   * WHICH PAGE A BACK GOES TO, which was not a question until now.
   *
   * Every page came off the front list, so back was always the front list and
   * the button could say "‹ Settings" without thinking. Troubleshooting is
   * inside About now, and a back that walked past the page you came from
   * would be the app forgetting where you were standing.
   *
   * One entry, because there is one nested page. It is a map rather than an
   * `if` so the next one is a line rather than a branch.
   */
  const PARENT = { offline: 'link', updating: 'link', access: 'developer', sales: 'developer', accounts: 'developer', messages: 'developer', live: 'developer', usage: 'developer', stuck: 'developer' }
  const UP_LABEL = { link: `‹ ${PAIR_TITLE}`, developer: '‹ Developer' }
  const upFrom = (p) => PARENT[p] || null
  const upLabel = (p) => UP_LABEL[PARENT[p]] || '‹ Settings'

  const head = (title, onDone) =>
    onDone === 'back' ? (
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <Press label={upLabel(page)} height={40} onPress={() => setPage(upFrom(page))} />
          <Press label="Done" height={40} onPress={onBack} />
        </View>
        <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
          {title}
        </Text>
      </View>
    ) : (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
          {title}
        </Text>
        <Press label="Done" height={40} onPress={onBack} />
      </View>
    )

  /* One step up, whatever that means from where you are standing. The swipe
     and the Back button are the same errand, so they ask the same function. */
  const goBack = () => (page === null ? onBack?.() : setPage(upFrom(page)))
  /* Android's back, one page up, the same as the swipe and the Back button —
     heard here before App.js hears it, because only this screen knows it has
     pages inside it. */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack()
      return true
    })
    return () => sub.remove()
  })

  return (
    <EdgeBack onBack={goBack}>
    <ScrollView
      ref={scroller}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxl }}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!held}
      /* Where each page is scrolled to, for coming back up to it (above). */
      onScroll={(e) => {
        offsets.current[page ?? ''] = e.nativeEvent.contentOffset.y
      }}
      scrollEventThrottle={100}
    >
      {page === null ? (
        <>
          {head('Settings')}
          {/* A newer version in the store, said once for each store version. Here, never on Play. */}
          <NewerInStore />
          {/*
            SETTINGS, IN GROUPS.

            "Think of anything that can be made so that the user has an easier
            time quickly locating settings they wanna check out. As right now
            I don't think it's very clear." Ten rows of the same weight meant
            reading every one to find anything. Now the account sits on top as
            a card, and the rest is under five headings that say what each
            group is for: the rig, the play screen, help, about, and — on his
            account only — developer.

            Two rows left. Renaming presets and scenes is part of the preset,
            so it went to the Edit screen beside it. Troubleshooting came up
            out of About, where it was two taps deep on the evening it is
            needed most.
          */}
          <AccountCard
            asked={asked}
            email={signedInAs || keptEmail}
            offline={Boolean(keptEmail)}
            paired={isPairAccount((account || kept)?.email)}
            unlocked={purchase.unlocked}
            demo={demo}
            onPress={() => {
              setNote(null)
              setError(null)
              setPage('account')
            }}
          />

          <Group title="My rig">
            {/*
              One row for the whole chain: this phone, the computer, and the
              unit plugged into it — the status says how far along it gets.
            */}
            <SetupRow
              title={PAIR_TITLE}
              status={
                demo
                  ? `Demo — simulated ${DEMO_UNITS.find((u) => u.key === unit)?.name || 'unit'}`
                  : bluetooth
                    ? bluetoothWord
                    : link !== 'connected'
                      ? linkWord
                      : unitState === 'missing'
                        ? 'Computer connected · no unit'
                        : unitState === 'silent'
                          ? `Computer connected · ${deviceName || 'unit'} not answering`
                          : `${deviceName || 'Unit'} · connected`
              }
              onPress={() => setPage('link')}
            />
            {/*
              BLUETOOTH (BETA), ITS OWN ROW. "Move the Bluetooth card from the
              phone and computer menu to its own menu under the settings menu.
              Still saying Bluetooth (beta)." The phone straight to the unit,
              through a Bluetooth MIDI adapter on its MIDI In and Out, with no
              computer. Behind the purchase (mayDriveBluetooth, above: with no
              signal, "the store cannot be reached" lets a free account drive
              the computer's link, which needs the internet anyway, but would
              give it Bluetooth for good), and only in a build that carries
              the Bluetooth code on a phone that can do it: anybody else never
              sees it. The page it opens carries the beta note, the
              iPhone's or Android's own (betaNote), always shown under
              Connect and the rows that open.

              AND ONLY WHERE IT IS OPEN. "Is there any way to just get the
              Bluetooth on the developers mode for my own phone? I just feel
              like it's not ready to have public." So the row also waits for
              bluetoothAllowed, and is asked that before the build check, so a
              customer's phone is never even asked whether it can do
              Bluetooth. Yes on his account; for anybody else, only on a copy
              whose built-in store version opens it (lib/ble-rule.js): a new
              store version whose review notes say so, never an update
              (CLAUDE.md).

              Off, the row says what it is for and what it costs against the
              computer, in the one line it has (BLUETOOTH_ROW_OFF, beside the
              Bluetooth page's own sentence in the gear file): "make it clear
              that the computer is the preferred method". Not the cost alone,
              which read as a row with nothing going for it, in the row's
              green.
            */}
            {mayDriveBluetooth(purchase, bluetoothAdmin) && bluetoothAllowed && bluetoothSupported() ? (
              <SetupRow
                title="Bluetooth (beta)"
                status={bluetooth ? `On · the ${deviceNoun()} talks to the unit itself` : BLUETOOTH_ROW_OFF}
                onPress={() => setPage('bluetooth')}
              />
            ) : null}
            {/*
              THE LOOPER'S EMERGENCY STOP. "There needs to be something in
              settings … for when it keeps playing." It carries on across a
              preset change when the next preset has a Looper block too, and
              this stops it on one tap from wherever the player is.
            */}
            {/* What each switch does, read off the unit — the browser's
                Footswitches panel, here. Only where the switches can be read. */}
            {(link === 'connected' || demo) && switchesReadable ? (
              <SetupRow title="Footswitches" status="What each switch does" onPress={() => setPage('footswitches')} />
            ) : null}
            {/* Not over Bluetooth (beta): the looper is left off its chain.
                And not on a real VP4: no computer app can work its looper,
                so the row could only say "Didn’t stop" (lib/vp4-safety
                VP4_NO_LOOPER). The browser's Setup leaves it out too. */}
            {(link === 'connected' || demo) && !overBluetooth(caps) && !onRealVp4 ? (
              <SetupRow
                title="Stop the looper"
                status={looperSaid || 'If a loop keeps playing'}
                onPress={stopTheLooper}
              />
            ) : null}
            {/* "A metronome that plays out loud that can be toggled on and
                off in settings." On the unit, the phone or both. */}
            <SetupRow
              title="Metronome"
              status={metronomeNote(clickSetting, rigSlug, rigBpm, { ...clickHere, heard: clickHeard })}
              onPress={() => setPage('metronome')}
            />
            {/* A VP4's Scene Select number and MIDI channel, on a real VP4
                only: presets by Program Change, scenes on the number the
                player set on the pedal (components/Vp4Setup). */}
            {onRealVp4 ? (
              <SetupRow title={MIDI_SETUP_TITLE} status={vp4SetupStatus(readVp4Setup(sync), caps)} onPress={() => setPage('vp4')} />
            ) : null}
          </Group>

          <Group title="Help">
            {/* Up from inside About: the page needed most on a bad evening
                is now one tap from Settings, not two. */}
            {onOpenFixes || onOpenLog || onOpenReport ? (
              <SetupRow
                title="Troubleshooting"
                status="What to try, the log, and telling us"
                onPress={() => setPage('trouble')}
              />
            ) : null}
            {/*
              THE FEEDBACK FORM, ONE TAP FROM SETTINGS. "Super easy for all
              users to submit bugs and feedback" (25 October 2026). It was
              Settings → Troubleshooting → Feedback, the last row of a page
              about fixes. That stays where it is, word for word, because the
              fixed help sentence (shared/affiliation.mjs), the website's
              support and Pi pages and the store text all name that path; this
              is another way in to the same form, not a move.
            */}
            {onOpenReport ? (
              <SetupRow title="Report a problem or idea" status="Something broken, or something you want" onPress={onOpenReport} />
            ) : null}
            {/* What each model on the unit really is — something to look up
                while playing, so it sits with the help rather than first. */}
            {onOpenGear ? (
              <SetupRow title="Amp & pedal names" status="What each model on your unit really is" onPress={onOpenGear} />
            ) : null}
            {onReplay ? <SetupRow title={REPLAY} status="The setup, from the start" onPress={onReplay} /> : null}
            {/* "Add a watch section to the iOS app so that people know how to
                use it and how to set it up, and then they know that there is
                a watch companion app." iPhone only: there is no Android watch,
                and an iPad cannot be paired with one. */}
            {Platform.OS === 'ios' && deviceKind() !== 'ipad' && watchSupported() ? (
              <SetupRow
                title="Apple Watch"
                status={watchPaired() ? 'On your watch · how to use it' : 'Scenes, pedals, presets and the tuner on your wrist'}
                onPress={() => setPage('watch')}
              />
            ) : null}
            {/* "Update a section in the app that will say how to manage
                Siri." The phrases, the one rule, the shortcuts and how to
                turn it off; on Android, the links for Tasker. */}
            {siriOpen ? <SetupRow title={SIRI_TITLE} status={siriStatus} onPress={() => setPage('siri')} /> : null}
          </Group>

          <Group title="About">
            {/*
              The version, and an update waiting says so here, where the list
              is read, instead of one page further in.
            */}
            <SetupRow
              title="About"
              status={updates.phase === 'ready' ? 'Update ready — tap to restart into it' : `v${APP_VERSION}`}
              onPress={() => (updates.phase === 'ready' ? applyNow() : setPage('about'))}
            />
          </Group>

          {/* Justin's own tools, on his account only — see lib/admin.js. One
              row for all three: "we should probably just make that into one
              menu called developer". */}
          {isAdmin(account?.id) ? (
            <Group title="Developer">
              <SetupRow title="Developer" status="Access, sales, accounts, messages, what's live" onPress={() => setPage('developer')} />
            </Group>
          ) : null}

          {/* Last: "Move the Play Screen section down to the bottom of the list." */}
          <Group title="Play screen">
            <SetupRow
              title="Tiles & scenes"
              status="Tile size, effect pictures, scene layout"
              onPress={() => setPage('appearance')}
            />
            {/* "Let's make the colors match better", and choose your own. */}
            <SetupRow title="Colors" status={coloursStatus({ unitName: deviceName, capabilities: caps })} onPress={() => setPage('colours')} />
            {/* Light or dark right here: one tap, not a page to open for it. */}
            <View style={{ paddingVertical: space.md }}>
              <Appearance />
            </View>
          </Group>
        </>
      ) : null}

      {/* -------------------------------------------------------- account */}
      {page === 'account' ? (
        <>
          {head('Account', 'back')}
          {/* Everything about who this is, in one place. It was the bottom of
              Phone & computer, which nobody would think to open to change a
              password. */}
          <View style={{ gap: space.md }}>
            {signedInAs ? (
              <TipCard
                icon={mailIcon}
                label="SIGNED IN"
                body={`${account.email}\nTap for password options`}
                onPress={() => {
                  setNote(null)
                  setError(null)
                  setAccountMenu(true)
                }}
              />
            ) : keptEmail ? (
              /* Signed in by the sign-in kept on the phone, which the account
                 service has not vouched for: no password sheet to open, since
                 it needs the service, and no Sign in, which needs it too. */
              <TipCard icon={mailIcon} label="SIGNED IN" body={`${keptEmail}\n${asked ? KEPT_OFFLINE : 'Checking…'}`} />
            ) : (
              <>
                <Text style={{ color: color.silkDim, fontSize: font.small }}>
                  {!asked
                    ? 'Checking…'
                    : isPairAccount((account || kept)?.email)
                      ? `Paired with your computer, no account. What you save stays on this ${deviceNoun()}.`
                      : 'Not signed in on this device.'}
                </Text>
                {/* Paid on this phone with no account yet: until there is one,
                    the computer and the website see nothing bought. */}
                {asked && !account?.email && !keptHere && purchase.onlyHere && onMakeAccount ? (
                  <>
                    <Note>{ONLY_HERE}</Note>
                    <Press label="Make an account" tone="signal" onPress={onMakeAccount} />
                  </>
                ) : null}
                {/* Not while a sign-in is kept on the phone (a phone paired by
                    code, with no signal): the form needs the internet the
                    phone does not have, and is no way back from itself. */}
                {asked && onSignIn && !keptHere ? <Press label="Sign in with an email and password" onPress={onSignIn} /> : null}
              </>
            )}

            {/* Paid on this phone, sent to this account and not arrived yet:
                said where the account is looked at (purchases.js, stuck).
                With nobody signed in, its own line, which offers no Restore:
                the Sign in above is the way. */}
            {purchase.stuck ? (
              <Note tone="warn">{purchase.held === NOT_ACROSS_SIGNED_OUT ? NOT_ACROSS_SIGNED_OUT : NOT_ACROSS}</Note>
            ) : null}
            {note ? <Note>{note}</Note> : null}
            {error ? <Note tone="fault">{error}</Note> : null}

            {/* Busy while it goes: with no signal it can take a couple of
                seconds (relay.js signOut), and a button that does nothing for
                that long gets tapped again, or the app closed. */}
            <Press
              label={leaving ? 'Signing out…' : `Sign out on this ${deviceNoun()}`}
              disabled={leaving}
              onPress={async () => {
                setLeaving(true)
                try {
                  await onSignOut?.()
                } finally {
                  setLeaving(false)
                }
              }}
            />
            <Text style={{ color: color.silkFaint, fontSize: font.micro, lineHeight: 18 }}>
              The computer stays signed in — signing out here must not drop the link mid-set.
            </Text>

            {/* Apple Guideline 5.1.1(v): an account made in the app can be
                deleted in the app. On this page, and named plainly, so it is
                found where an account is looked for. */}
            {signedInAs ? (
              <Press
                label="Delete account"
                sub="Remove this account and everything saved under it"
                onPress={() => {
                  setNote(null)
                  setError(null)
                  setDeleting(true)
                }}
              />
            ) : null}
          </View>

          <Sheet open={deleting} onClose={() => (busy ? null : setDeleting(false))} title="Delete account" note={account?.email || ''}>
            <Text style={{ color: color.silk, fontSize: font.small, lineHeight: 21 }}>
              This deletes your account for good: your sign-in, your set lists, bug reports you sent from it and
              everything else stored under it. It happens straight away and cannot be undone. Any computer signed in
              to this account is signed out.
            </Text>
            {/*
              TRUE ONLY OF A STORE PURCHASE, and it was said to everybody.
              Deleting the account deletes the customer that holds a website
              purchase or a gift, and no Restore brings either back — so
              somebody who bought on the website was told it would survive,
              made the account again, and could have paid again.
            */}
            <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 21 }}>
              {deleteCosts(from)}
            </Text>
            <Press
              label={busy ? 'Deleting…' : 'Delete my account'}
              tone="live"
              disabled={busy}
              onPress={async () => {
                setBusy(true)
                try {
                  await deleteAccount()
                  setDeleting(false)
                  Alert.alert('Account deleted', `${account?.email || 'Your account'} has been deleted, and you are signed out.`)
                  onSignOut?.()
                } catch (err) {
                  setDeleting(false)
                  setError(err.message)
                } finally {
                  setBusy(false)
                }
              }}
            />
            <Press label="Keep my account" disabled={busy} onPress={() => setDeleting(false)} />
          </Sheet>

          {/*
            THE FULL VERSION, AND THE WAY BACK TO ONE ALREADY PAID FOR.

            The Restore a purchase Apple requires, for somebody who paid and
            is on a new handset — and gone once the app is unlocked: "the
            unlock full version needs to disappear if it has been unlocked."
          */}
          <View style={{ gap: 0 }}>
            {purchase.unlocked ? null : (
              <SetupRow
                title="Unlock the full version"
                status={purchase.price ? `Drive a real rig · ${purchase.price}` : 'Drive a real rig, or restore a purchase'}
                onPress={onUnlock}
              />
            )}
          </View>

          <Sheet open={accountMenu} onClose={() => setAccountMenu(false)} title="Your account" note={account?.email || ''}>
            <Press
              label="Change password"
              sub="Type a new one here, twice"
              onPress={() => {
                setAccountMenu(false)
                setChanging(true)
              }}
            />
            <Press
              label={busy ? 'Sending…' : 'Email me a link to reset it'}
              sub="For when the old one is forgotten"
              disabled={busy}
              onPress={async () => {
                setBusy(true)
                try {
                  await sendPasswordReset(account.email)
                  setAccountMenu(false)
                  setNote(`A link to set a new password is on its way to ${account.email}.`)
                } catch (err) {
                  setAccountMenu(false)
                  setError(err.message)
                } finally {
                  setBusy(false)
                }
              }}
            />
          </Sheet>

          <PasswordBox
            open={changing}
            onChange={async (next) => {
              await changePassword(next)
              setNote('Password changed.')
            }}
            onClose={() => setChanging(false)}
          />
        </>
      ) : null}

      {/* ------------------------------------------------------ developer */}
      {page === 'developer' && isAdmin(account?.id) ? (
        <>
          {head('Developer', 'back')}
          <View style={{ gap: 0 }}>
            <SetupRow title="Give someone access" status="Look someone up, or unlock them" onPress={() => setPage('access')} />
            <SetupRow title="Sales at a glance" status="Today, this week, all time" onPress={() => setPage('sales')} />
            <SetupRow title="How many people" status="Who used it today, this week, this month" onPress={() => setPage('usage')} />
            <SetupRow title="Everyone with an account" status="Who has signed up" onPress={() => setPage('accounts')} />
            <SetupRow title="Paid but no computer yet" status="Bought it, never set up the computer" onPress={() => setPage('stuck')} />
            <SetupRow title="Messages from users" status="Bug reports and suggestions, with their logs" onPress={() => setPage('messages')} />
            <SetupRow title="What's live" status="Which version each piece is on" onPress={() => setPage('live')} />
            {onViewAsCustomer ? (
              <SetupRow
                title="View as a new customer"
                status="The walkthrough and the paywall, as a stranger sees them"
                onPress={onViewAsCustomer}
              />
            ) : null}
          </View>
        </>
      ) : null}

      {/* ------------------------------------------------------ appearance */}
      {page === 'footswitches' ? (
        <>
          {head('Footswitches', 'back')}
          <Footswitches />
        </>
      ) : null}

      {page === 'appearance' ? (
        <>
          {head('Tiles & scenes', 'back')}
          <View style={{ gap: space.md }}>
            <Section>Stage tiles</Section>
            <TileSize onScrollLock={setHeld} />
          </View>
        </>
      ) : null}

      {/* ---------------------------------------------------------- colours */}
      {page === 'colours' ? (
        <>
          {head('Colors', 'back')}
          <Colours />
        </>
      ) : null}

      {/* -------------------------------------------------- troubleshooting */}
      {page === 'trouble' ? (
        <>
          {head('Troubleshooting', 'back')}
          <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 20 }}>
            In order: try the fixes, read the log if they did not help, then tell us and the log
            goes with it.
          </Text>
          <View style={{ gap: 0 }}>
            {onOpenFixes ? (
              <SetupRow
                title="Fixes"
                status="What to try when it isn’t working"
                onPress={onOpenFixes}
              />
            ) : null}
            {/* Called Log, because that is what it opens. It said "Help &
                fixes" — the name of the row directly above it, which opens
                something else entirely. */}
            {onOpenLog ? (
              <SetupRow
                title="Log"
                status={`${getDebugLog().length} line${getDebugLog().length === 1 ? '' : 's'} in the log`}
                onPress={onOpenLog}
              />
            ) : null}
            {/* Last of the three, and the one that goes the other way: Fixes
                and the log are things to read, this is the thing to send when
                neither helped. */}
            {onOpenReport ? (
              <SetupRow
                title="Feedback"
                status="Something broken, or something you want"
                onPress={onOpenReport}
              />
            ) : null}
          </View>
        </>
      ) : null}

      {/* ------------------------------------------------------ phone & mac */}
      {page === 'link' ? (
        <>
          {head(PAIR_TITLE, 'back')}
          {/* Said first, because everything under it is about a computer
              this phone is not using while it is on. */}
          {/* And the two ways, with the computer the best one: the Bluetooth page's own sentence (BLUETOOTH_WAYS). */}
          {bluetooth && !demo ? (
            <Note tone="warn">
              {`Bluetooth (beta) is on. This ${deviceNoun()} talks to the unit directly, not through the computer. ${BLUETOOTH_WAYS}`}
            </Note>
          ) : null}

          <View style={{ gap: space.md }}>
            <Section>The link</Section>
            {/*
              THE CHAIN, AS CARDS. "I thought we updated this to a new
              format… always make sure you're updating all the platforms."
              The unit, the computer and this phone, each with a lamp, joined
              by the two wires from How it works — and the words come from
              lib/link-chain, the same file the browser's page draws from.
              The unit's firmware and both version numbers live on the cards
              now; they were three separate lines under a lamp.

              The computer card's red "Update the computer app" line is a
              link: "change red text about updating computer to a link that
              shows instructions when tapped on how to update it." The card
              takes the tap and opens page 'updating'.
            */}
            <ChainCards
              cards={linkChain({
                here: 'phone',
                demo,
                via: throughAdapter ? 'bluetooth' : 'computer',
                unit: {
                  name: demo ? DEMO_UNITS.find((u) => u.key === unit)?.name || 'FM3' : deviceName,
                  firmware,
                  state: unitState
                },
                /* A VP4 on a computer that cannot change its scenes and presets: the red line says so too (lib/vp4-safety vp4ComputerLacks). */
                computer: { name: macName, version: hostVersion, link, lacks: vp4ComputerLacks(onRealVp4, caps) },
                /* Over Bluetooth, link.js's macName is the adapter's name. */
                adapter: { name: macName, link },
                phone: {
                  version: APP_VERSION,
                  email: account?.email && !isPairAccount(account.email) ? account.email : null
                }
              })}
              onWarn={() => setPage('updating')}
            />

            {/* What to do about a unit that is missing or silent, under the
                card that says so. The usual reason besides the cable is
                Fractal's own editor holding the unit — named, per unit where
                it is known (lib/editors.js). */}
            {link === 'connected' && !demo && !throughAdapter && (unitState === 'missing' || unitState === 'silent') ? (
              <Note tone="fault">
                {unitState === 'missing'
                  ? `${quitEditor(deviceName)} This finds the unit again by itself once it is free.`
                  : `A frozen unit looks like this. ${quitEditor(deviceName)}`}
              </Note>
            ) : null}

            {/*
              The demo says what it is and offers the way out, first, because
              everything under it is about a computer this is not talking to.
            */}
            {demo ? (
              <>
                {/*
                  A VP4 says its own sentence (VP4_DEMO, by demoSentence). "Every
                  screen works" is true of the demo's VP4 and the opposite of a
                  real one's, and this page is where a VP4 owner trying the demo
                  before paying looks to see what it is.
                */}
                <Note tone="warn">
                  {unit === 'vp4'
                    ? `${demoSentence(unit)} It also answers instantly, so anything still slow in here is this app rather than the line to a computer.`
                    : `This is the demo — a simulated ${
                        DEMO_UNITS.find((u) => u.key === unit)?.name || 'FM3'
                      }. Every screen works and nothing reaches hardware. It also answers instantly, so anything still slow in here is this app rather than the line to a computer.`}
                </Note>
                {/*
                  Which unit, because the demo was an FM3 and only an FM3 —
                  and an AM4 owner opening it saw eight scene tiles their unit
                  has not got. Each of these holds its own real factory bank:
                  the preset names and the scene names the unit ships with.
                */}
                <Section>Which unit</Section>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {DEMO_UNITS.map((u) => (
                    <Press
                      key={u.key}
                      label={u.name}
                      tone="signal"
                      on={u.key === unit}
                      height={44}
                      style={{ paddingHorizontal: space.md }}
                      onPress={() => setDemoUnit(u.key)}
                    />
                  ))}
                </View>
                {/*
                  THE WAY OUT IS FOR SOMEBODY WHO HAS PAID.

                  "Someone should only be able to exit a demo if they've
                  already purchased the app or paid."

                  It used to be here for everybody, and for somebody who has
                  not paid it was a door to an empty room: the live app with
                  no unlock is a screen that cannot drive anything. The demo
                  IS the app until it is bought.

                  Nobody is shut in. Heading for Sign in ends the demo too —
                  see App.js's toSignIn — and the sign-in screen offers the
                  demo again, so the way out for somebody who has not paid is
                  the one they would take anyway.

                  The same words as the bar, because it is the same errand and
                  two words for one action is how the two ends drifted apart
                  everywhere else in this app.
                */}
                {purchase.unlocked ? (
                  <TipCard icon={playIcon} label="EXIT DEMO" body="Back to your own rig" onPress={() => setDemo(false)} />
                ) : null}
              </>
            ) : null}
            {/*
              No DEMO card here any more. "Remove the demo card from the phone
              and computer screen. If a user wants to access it again, they can
              still access it from the show walkthrough." Settings → Show the
              walkthrough → Try the demo is the way in, for everybody.
            */}

            {/*
              What the computer is running, and whether that is behind, is on
              the YOUR COMPUTER card now, in red: "instead of having that
              warning, just use the 'your computer' card instead, and have a
              very short message". See shared/link-chain.mjs.
            */}

            {/* A computer on this wifi on another account is the reason, and it is
                said instead — see useComputerElsewhere. */}
            {link === 'no-answer' && elsewhere ? (
              <Note tone="fault">
                {account?.email && !isPairAccount(account.email)
                  ? `The computer on this wifi is signed into a different account. This ${deviceNoun()} is signed in as ${account.email}. On the computer, sign in to the Fractal Remote app with ${account.email}, or sign this ${deviceNoun()} out below and into the computer’s account.`
                  : `The computer on this wifi is signed into a different account than this ${deviceNoun()}. Sign both into the same account.`}
              </Note>
            ) : noneSaid ? (
              <Note tone="warn">
                <NoComputerWords email={noComputer.email} />
              </Note>
            ) : link === 'no-answer' ? (
              <Note tone="warn">
                Open the Fractal Remote app on the computer and make sure the computer is awake. This keeps trying on
                its own.
              </Note>
            ) : null}
            {/* And the download link to their inbox, under those words and
                only with them: to the account's own address, which they name. */}
            {noneSaid ? <SendLinkButton email={noComputer.email} /> : null}
            {/* And, where this copy offers Bluetooth (beta), the other way
                for an AM4, after the words and their button, never between
                them (components/NoComputer.js NoComputerOtherWay). */}
            {noneSaid ? <NoComputerOtherWay /> : null}
            {/* Which account this is — his words: "make sure you're connected
                to your computer using and then show the user's email
                address". A computer signed in as somebody else is the
                likeliest reason nothing answers. */}
            {/* And not under "No computer is signed in with this account yet",
                which names the account already, and beside which "make sure
                you're connected" is about a computer that is not there. */}
            {link === 'no-answer' && account?.email && !isPairAccount(account.email) && !noneSaid ? (
              <Note>{`Make sure you’re connected to your computer using ${account.email}.`}</Note>
            ) : null}

            {/*
              The way in to getting a computer on the other end at all.

              It was a row of its own on the front of Setup, called
              "Connecting a computer", sitting between two rows about a
              computer that was already connected. It belongs here, on the
              page about the line to that computer — and it stays offered even
              once the line is up, because the second computer somebody wants
              to add is one they add on an evening when the first one works.
            */}
            {onOpenConnect ? (
              <TipCard icon={laptopIcon} label="CONNECT A COMPUTER" body="How do I connect a computer?" onPress={onOpenConnect} />
            ) : null}

            {/*
              PLAYING WITH NO INTERNET, told to the people who paid for the app.
              
              "Let's make that some kind of option in the app or to tell people
              how to do it to connect without internet and give instructions to
              people that have already unlocked it."

              The route is real and it is the only one that works in a room with
              no signal, but it was advertised in the wrong place: the website's
              signed-out screen, headed "no account, no code", where it read as
              a way around paying. It is off that screen now. This is where it
              belongs instead — behind the unlock, told to somebody who has
              already bought the thing.

              AND IT IS NOT THIS APP THAT DOES IT, which is the part that has to
              be said plainly rather than implied. Everything here goes through
              the relay, which is on the internet; there is no code in this app
              that speaks to a computer over wifi, and pretending otherwise
              would have somebody trying it on a stage. What works is the phone's
              WEB BROWSER on the computer's own page, so that is what the
              instructions say to open.

              `mayDrive` rather than `purchase.unlocked` on purpose: it also says
              yes when the store could not be reached, and a person whose signal
              is bad is exactly the person who needs to read this.
            */}
            {/*
              A card of its own, like Connect a computer, opening a page of its
              own. "Let's make the how to connect without internet its own
              button… the text on it right now is extremely small and hard to
              read, so it would be nice to have it bigger and everything on its
              own page." The words are the same; they are on page 'offline'.
            */}
            {mayDrive(purchase) ? (
              <TipCard
                icon={phoneIcon}
                label="PLAYING WITH NO INTERNET"
                body="How do I play with no internet?"
                onPress={() => setPage('offline')}
              />
            ) : null}


            {/*
              Only while there is something to try. "The Try now button is
              there and if you click it it does — I'm not sure why it's even
              there if we're already all connected." It looks for the computer
              again, which on a live link is a button that does nothing you
              can see. Said as what it does, too.
            */}
            {/* Over Bluetooth, on an iPhone whose adapter has gone, Apple's
                screen first (lib/bluetooth lookForAdapterAgain), and said
                under the button whenever the tap will open it
                (APPLE_SCREEN_OPENS), as on the waiting screen. */}
            {link !== 'connected' ? (
              <Press
                label={throughAdapter ? 'Look for the adapter again' : 'Look for the computer again'}
                sub={throughAdapter && opensApplesScreen() ? APPLE_SCREEN_OPENS : undefined}
                onPress={throughAdapter ? () => lookForAdapterAgain(onReconnect) : onReconnect}
              />
            ) : null}
          </View>

          {/*
            WHICH UNIT, when more than one computer on this account answers.
            "Instead of which computer, have it say which unit, and list the
            units online." The unit leads and its computer is the line under
            it; each phone remembers its own, so one phone can run the FM3
            while another runs the AM4. See unitChoices in relay-rules.
          */}
          {hosts.length > 1 ? (
            <View style={{ gap: space.md }}>
              <Section>Which unit</Section>
              {conflict ? <Note tone="fault">{conflict}</Note> : null}
              {unitChoices(hosts, units, chosen, unitsAsking).map((row) => (
                <View key={row.key} style={{ gap: space.xs }}>
                  <Press
                    label={row.label}
                    tone="live"
                    on={row.on}
                    onPress={async () => {
                      await chooseHost(row.name)
                      setChosen(remoteChosenHost())
                      setUnits(remoteUnits())
                      setMissing(remoteMissingPick())
                    }}
                  />
                  <Text style={{ color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }}>{row.detail}</Text>
                </View>
              ))}
              {/* The pick that does not answer, grayed, with Forget. */}
              <MissingPick
                name={missing}
                onForget={() => {
                  forgetMissing()
                  setMissing(remoteMissingPick())
                }}
              />
              {/* How one you don't use comes off this list: at that computer (relay-rules notUsingOne). */}
              <Text style={{ color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }}>{notUsingOne('app')}</Text>
            </View>
          ) : null}

          {/* Who this is signed in as moved to its own Account page, off the
              top of Settings: "change password" under "Phone & computer" was
              somewhere nobody would look. */}
        </>
      ) : null}

      {/* ------------------------------------------------------- bluetooth */}
      {/* The page, behind the same gate as its row on Settings, his account
          included. Its Testing tools are Justin's alone (admin), as the
          Developer pages are: Apple's 2.2 keeps test benches out of what
          customers see. */}
      {page === 'bluetooth' && mayDriveBluetooth(purchase, bluetoothAdmin) && bluetoothAllowed && bluetoothSupported() ? (
        <>
          {head('Bluetooth (beta)', 'back')}
          <BluetoothPage purchase={purchase} admin={isAdmin(account?.id)} onReport={onReportBluetooth} />
        </>
      ) : null}

      {/* ------------------------------------------------------- metronome */}
      {page === 'metronome' ? (
        <>
          {head('Metronome', 'back')}
          <View style={{ gap: space.md }}>
            <Press
              label={clickSetting.on ? 'Metronome on' : 'Metronome off'}
              tone="live"
              on={clickSetting.on}
              height={TAP}
              onPress={() => changeClick({ on: !clickSetting.on })}
            />
            <Section>Where it clicks</Section>
            {/* Only Phone where the unit's click cannot be switched: Unit and Both would click nowhere.
                It is lit then, being what clicks, and a tap on it keeps a saved Unit for when the unit can. */}
            {placesFor(unitCan.can).map((p) => (
              <View key={p.key} style={{ gap: space.xs }}>
                <Press
                  label={p.label}
                  tone="live"
                  on={placeLit(clickSetting, p.key, unitCan.can)}
                  onPress={() => (unitCan.can ? changeClick({ where: p.key }) : null)}
                />
                <Text style={{ color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }}>{p.note}</Text>
              </View>
            ))}
            {clickSaid ? <Note tone="fault">{clickSaid}</Note> : null}
            <Note tone="hint">
              {`It keeps the unit’s tempo${Number.isFinite(rigBpm) ? `, ${Math.round(rigBpm)} BPM right now` : ''}: tap tempo changes it. ${
                unitCan.can ? 'The unit’s click comes out of the unit with your guitar, in steady time — the one to play to.' : unitCan.why
              }${
                unitCan.can && clickSetting.on && clickSetting.where === 'unit' && !clickHeard
                  ? ` Until the unit says its click is on, the ${deviceNoun()} keeps time as well.`
                  : ''
              }`}
            </Note>
            {/*
              FLASH TIMING. "The visual edge screen flash is not actually
              matching up with the sound that the phone makes." The flash now
              waits for the click by as long as this phone usually takes to
              make it, but a Bluetooth speaker or headphones take longer, and
              the phone cannot tell from here which it is playing through.
              So the flash can be moved to meet the click, by ear.
            */}
            {phoneMayClick ? (
              <>
                <Section>Flash timing</Section>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Press
                    label="Earlier"
                    grow
                    disabled={flashTiming <= nudgeFloor(Platform.OS)}
                    onPress={() => setFlashTiming(flashTiming - FLASH_NUDGE.step)}
                  />
                  <Press
                    label="Later"
                    grow
                    disabled={flashTiming >= FLASH_NUDGE.max}
                    onPress={() => setFlashTiming(flashTiming + FLASH_NUDGE.step)}
                  />
                </View>
                <Text style={{ color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }}>
                  {`${flashTimingNote(flashTiming, Platform.OS)}. If the flash comes before the click, tap Later; if it comes after, tap Earlier. Through a Bluetooth speaker or headphones it usually needs Later several times.`}
                </Text>
                {flashTiming !== 0 ? <Press label="Back to standard" onPress={() => setFlashTiming(0)} /> : null}
              </>
            ) : null}
            {/* "Same with the watch, metronome that can beep on the watch."
                Its own switch: the wrist keeps time whichever end clicks. */}
            {Platform.OS === 'ios' && deviceKind() !== 'ipad' && watchSupported() ? (
              <>
                <Section>Apple Watch</Section>
                <Press
                  label={clickSetting.watch ? 'Tap on the watch: on' : 'Tap on the watch: off'}
                  tone="live"
                  on={clickSetting.watch}
                  onPress={() => changeClick({ watch: !clickSetting.watch })}
                />
                <Text style={{ color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }}>
                  A tap and a tick on every beat, while the Fractal Remote app is open on the watch.
                </Text>
              </>
            ) : null}
          </View>
        </>
      ) : null}

      {/* ------------------------------------------------------------- vp4 */}
      {page === 'vp4' && onRealVp4 ? (
        <>
          {head(VP4_SETUP.title, 'back')}
          <Vp4Setup caps={caps} firmware={firmware} />
        </>
      ) : null}

      {/* ---------------------------------------------------------- access */}
      {page === 'access' && isAdmin(account?.id) ? (
        <>
          {head('Give someone access', 'back')}
          <AccessTool />
        </>
      ) : null}

      {/* ----------------------------------------------------------- sales */}
      {page === 'sales' && isAdmin(account?.id) ? (
        <>
          {head('Sales at a glance', 'back')}
          <SalesTool />
        </>
      ) : null}

      {/* ----------------------------------------------------------- usage */}
      {page === 'usage' && isAdmin(account?.id) ? (
        <>
          {head('How many people', 'back')}
          <UsageTool />
        </>
      ) : null}

      {/* ------------------------------------------------------------ live */}
      {page === 'live' && isAdmin(account?.id) ? (
        <>
          {head("What's live", 'back')}
          <LiveTool />
        </>
      ) : null}

      {/* -------------------------------------------------------- messages */}
      {page === 'messages' && isAdmin(account?.id) ? (
        <>
          {head('Messages from users', 'back')}
          <MessagesTool />
        </>
      ) : null}

      {/* -------------------------------------------------------- accounts */}
      {page === 'accounts' && isAdmin(account?.id) ? (
        <>
          {head('Everyone with an account', 'back')}
          <AccountsTool />
        </>
      ) : null}

      {/* ----------------------------------------------------------- stuck */}
      {/* "A 'paid but stuck' list on your Developer page" (15 October 2026). */}
      {page === 'stuck' && isAdmin(account?.id) ? (
        <>
          {head('Paid but no computer yet', 'back')}
          <StuckTool />
        </>
      ) : null}

      {/* ----------------------------------------------------------- about */}
      {/* -------------------------------------------------------- offline */}
      {/*
        PLAYING WITH NO INTERNET, on a page of its own, one step to a card and
        at a size that can be read — see the card on Phone & computer.

        AND IT IS NOT THIS APP THAT DOES IT, which is the part that has to be
        said plainly rather than implied. Everything here goes through the
        relay, which is on the internet; there is no code in this app that
        speaks to a computer over wifi. What works is the phone's WEB BROWSER
        on the computer's own page, so that is what the steps say to open.

        Behind `mayDrive` like the card, because it is told to the people who
        paid — see the note that used to sit on the link page.
      */}
      {page === 'offline' && mayDrive(purchase) ? (
        <>
          {head('Playing with no internet', 'back')}
          <Text style={{ color: color.silk, fontSize: font.body + 1, lineHeight: 24 }}>
            This app reaches your computer over the internet, so it needs a signal. For a room that
            has none, there is another way round and it does not use this app.
          </Text>
          <View style={{ gap: space.md }}>
            <TipCard icon={sendIcon} label="1  SAME WIFI" body={`Put the ${deviceNoun()} on the same wifi as the computer.`} />
            <TipCard
              icon={laptopIcon}
              label="2  OPEN THE CODE"
              body="On the computer, open the Fractal Remote app’s Settings → Phone & computer → Playing with no internet."
            />
            <TipCard
              icon={phoneIcon}
              label="3  POINT THE CAMERA"
              body={`Point the ${deviceNoun()}’s camera at the code there — it opens in the ${deviceNoun()}’s web browser.`}
            />
            <TipCard
              icon={setupIcon}
              label="OR TYPE THE ADDRESS"
              body="The same address is in the computer’s menu bar (the system tray on Windows), next to the Fractal Remote icon, to type instead."
            />
          </View>
          <Text style={{ color: color.silk, fontSize: font.body + 1, lineHeight: 24 }}>
            You get the same screens, and no part of it goes near the internet.
          </Text>
          <Note size={font.body}>
            What you change there is kept by that browser rather than in your account, so it does not
            follow you to this app or to another phone or tablet.
          </Note>
        </>
      ) : null}

      {/* -------------------------------------------------------- updating */}
      {/*
        HOW TO UPDATE THE COMPUTER APP, the page the red line on the YOUR
        COMPUTER card opens. "Change red text about updating computer to a
        link that shows instructions when tapped on how to update it."

        In the shape of Playing with no internet beside it — numbered cards,
        in type that can be read — because that is what he asked for on these
        pages. The words are lib/computer-update's (shared/computer-update.mjs),
        the same ones the browser's page draws, and each name in them is the
        computer app's own word for the thing.

        Not behind the purchase: a computer can be behind whoever is holding
        the phone.
      */}
      {page === 'updating' ? (
        <>
          {head(UPDATE_STEPS.title, 'back')}
          <Text style={{ color: color.silk, fontSize: font.body + 1, lineHeight: 24 }}>{UPDATE_STEPS.intro}</Text>
          {/*
            The address again under the step that gives it, and a tap copies
            it. In the card's narrow column it could split as "…cloud/download"
            and "s", and "/download" sends somebody to the web app instead of
            the downloads page, so both the card and the box break it only
            after the slash: the card where its line runs out
            (breakableAddress), the box always, on two lines in type no
            smaller than the page's (split). CopyAddress is the Connect a
            computer page's box, so a Mac on the same Apple account pastes it.
          */}
          <View style={{ gap: space.md }}>
            {UPDATE_STEPS.steps.map((step, i) => (
              <View key={step.label} style={{ gap: space.sm }}>
                <TipCard icon={[laptopIcon, setupIcon, sendIcon][i]} label={step.label} body={breakableAddress(step.body)} />
                {step.body.includes(DOWNLOADS_URL) ? <CopyAddress row split size={font.lead} saidSize={font.body} /> : null}
              </View>
            ))}
          </View>
          <Text style={{ color: color.silk, fontSize: font.body + 1, lineHeight: 24 }}>{UPDATE_STEPS.after}</Text>
          {/* What the computer's menu can say instead, each with the one thing to do. */}
          <View style={{ gap: space.md }}>
            {UPDATE_STEPS.ifItSays.map((entry) => (
              <Note key={entry.says} size={font.body}>
                <Text style={{ color: color.silk, fontWeight: '700' }}>{entry.says}</Text>
                {`\n${entry.body}`}
              </Note>
            ))}
          </View>
        </>
      ) : null}

      {page === 'watch' ? (
        <>
          {head('Apple Watch', 'back')}
          <View style={{ gap: space.md }}>
            <Note tone={watchPaired() ? undefined : 'fault'}>
              {watchPaired()
                ? 'Fractal Remote is on your Apple Watch.'
                : 'No Apple Watch with Fractal Remote on it is paired with this iPhone yet.'}
            </Note>

            <Section>What it does</Section>
            <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 24 }}>
              Fractal Remote comes with an Apple Watch app. Switch scenes, turn pedals on and off, step through presets
              and tune, all from your wrist, without reaching for the phone.
            </Text>

            <Section>Setting it up</Section>
            {WATCH_SETUP.map((line) => (
              <Text key={line} style={{ color: color.silk, fontSize: font.body, lineHeight: 24 }}>
                {line}
              </Text>
            ))}

            <Section>Keeping it on screen</Section>
            {WATCH_KEEP.map((line) => (
              <Text key={line} style={{ color: color.silk, fontSize: font.body, lineHeight: 24 }}>
                {line}
              </Text>
            ))}

            <Section>Using it</Section>
            {watchHow().map((line) => (
              <Text key={line} style={{ color: color.silk, fontSize: font.body, lineHeight: 24 }}>
                {line}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      {page === 'siri' && siriOpen ? (
        <>
          {head(SIRI_TITLE, 'back')}
          <SiriHelp os={Platform.OS} kind={deviceKind()} native={siriNative} noun={deviceNoun()} />
        </>
      ) : null}

      {page === 'about' ? (
        <>
          {head('About', 'back')}
          <Text style={{ color: color.silk, fontSize: font.body, fontFamily: face }}>
            {`Fractal Remote v${APP_VERSION}`}
          </Text>

          {/*
            INSIDE ABOUT, not beside it.

            "Move walkthrough, updates and troubleshooting INSIDE of the
            'About' menu."

            They were moved under About an hour ago, which was the smaller
            version of the same instruction: they are the rows you go looking
            for on an evening when something is wrong, or once, ever. Under it
            they still cost five lines of a list somebody opens to do
            something else. In it they cost one.

            What is left on the front page is the four things Setup is opened
            FOR, and one door to everything else.
          */}
          <View style={{ gap: 0 }}>
          {/*
            * WHAT IS RUNNING, AND HOW TO GET THE NEWEST.
            *
            * "I have not yet successfully had a single over-the-air update
            * work correctly. They never come through, so I keep refreshing
            * the android app, closing it, force closing it, reopening it
            * over and over again."
            *
            * They were arriving. What was missing was any way to SEE it,
            * plus one detail that makes a working app look stuck: this app
            * never waits for a download at launch — app.json sets
            * fallbackToCacheTimeout to 0, so it starts on the bundle it
            * already has, fetches the new one in the BACKGROUND, and runs it
            * the NEXT time it opens.
            *
            * First launch downloads. Second launch shows it. Somebody
            * force-closing once, seeing the same number and concluding
            * nothing happened was one restart short, with nothing on screen
            * to say so.
            *
            * That default is right for a stage and is not what changes here.
            * This says what is going on, and offers the restart instead of
            * waiting for it to happen by accident.
            */}
          <SetupRow
            title="Updates"
            status={
              updates.phase === 'ready'
                ? 'Ready — tap to restart into it'
                : updates.phase === 'downloading'
                  ? 'Downloading…'
                  : updates.phase === 'checking'
                    ? 'Checking…'
                    : updates.phase === 'current'
                      ? 'Up to date'
                      : updates.phase === 'off'
                        ? 'Not available in this build'
                        : updates.error
                          ? 'Could not check — tap to try again'
                          : `Running ${updates.source === 'update' ? 'an update' : 'the installed build'} · tap to check`
            }
            onPress={() => (updates.phase === 'ready' ? applyNow() : checkNow())}
          />
          {/*
            AND WHEN THE COPY ITSELF IS OLD. An update changes what the app
            does; only the store changes the copy it runs in, and once a new
            store version changes what an update needs, the older copies stop
            getting updates. Said here, quietly, for as long as it is true.
          */}
          {newer.note ? <SetupRow title={newer.note.row} status={newer.note.line} onPress={() => openStore(newer.note)} /> : null}
          {/*
            HELP WITH THIS APP, A ROW OF ITS OWN, at both ends in the same
            place. Fractal Audio's letter (18 October 2026) asks that support
            come through the developer's own channels. The browser's way to
            the support page sat in its small print, which opens closed, so
            it went up beside Updates there, and here too, so the two lists
            stay one list. Its line is short because a row's line is one line
            (SetupRow): "The support page, and how to reach a person" stopped
            at "a p…" on a 320-wide phone.
          */}
          <SetupRow
            title="Help with this app"
            status="Questions, problems, a person"
            onPress={() => Linking.openURL(SUPPORT_URL)}
          />
          </View>

          {/*
            No "What stays at the computer" box any more. It said saving was
            refused from a phone, and saving works from the phone now (the
            computer writes it — see lib/saveViaComputer). "Update or remove
            that message."
          */}
          {/*
            Reachable from inside the app, which is the point of writing them.
            A store requires a privacy policy at a URL and the licences we ship
            under require their notices travel with the software; neither is
            satisfied by a file nobody can open from the thing it describes.
          */}
          <View style={{ gap: space.md }}>
            <Section>The small print</Section>
            {/* Said in the app, not only in a file somebody would have to go
                looking for. Same string as the browser — shared/affiliation.mjs. */}
            <Note>{AFFILIATION}</Note>
            {/*
              AND WHERE HELP COMES FROM, which is never Fractal Audio. Their
              letter (18 October 2026) asks that support come through the
              developer's own channels, and nothing in the app named the
              support page until then. The line says both ways in; the row
              that opens the page is up with Updates.
            */}
            <Note>{SUPPORT_LINE}</Note>
            <Press
              label="Privacy"
              sub="What this sends, and what it never does"
              onPress={() => Linking.openURL('https://fractal.newbold.cloud/privacy.html')}
            />
            <Press
              label="Licenses"
              sub="The open-source work this is built on"
              onPress={() => Linking.openURL('https://fractal.newbold.cloud/notices.txt')}
            />
          </View>
        </>
      ) : null}
    </ScrollView>
    {/* The Colours page's Undo, floating over the bottom of the screen for a
        moment after a look goes on (components/Colours). Nothing otherwise. */}
    <LookUndo />
    </EdgeBack>
  )
}

/**
 * One row of Setup: a name, one line of live status, and a way in.
 *
 * The browser's own row, in this app's materials. Each carries the one fact you
 * would have opened it to learn, so the list answers most questions without
 * anybody tapping anything.
 */
/* How the watch app gets onto a watch. It comes with this app; nothing
   separate is bought or downloaded. */
const WATCH_SETUP = [
  'There is nothing separate to download. The watch app comes with Fractal Remote, and on most watches it installs by itself. On the watch it is called Fractal.',
  'If it is not on your watch: open the Watch app on this iPhone, scroll down to Available Apps, and tap Install next to Fractal Remote.',
  'It needs watchOS 10 or later, and the watch paired with this iPhone.'
]

/*
 * KEEPING IT ON THE WRIST. "It doesn't stay on very long, and then it'll
 * disappear." A watch goes back to the clock about two minutes after the
 * wrist drops, whatever the app, and dims sooner. Apple keeps both as the
 * wearer's own settings — no app may hold the screen on by itself — so the
 * help is telling him where they are.
 */
const WATCH_KEEP = [
  'On this iPhone, open the Watch app, then General, then Return to Clock. Scroll down, tap Fractal Remote, choose Custom, and set it to After 1 hour. The watch then comes back to Fractal Remote, not the clock, every time you raise your wrist.',
  'In the same Watch app, under Display & Brightness, turn on Always On. Fractal Remote stays on screen, dimmed, while your wrist is down.',
  'Also under Display & Brightness, set Wake Duration to Wake for 70 Seconds, so a tap on the screen keeps it bright for longer.'
]

function SetupRow({ title, status, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={status ? `${title}, ${status}` : title}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: TAP + 8,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        borderBottomWidth: 1,
        borderBottomColor: color.rule,
        backgroundColor: pressed ? color.panelHi : 'transparent'
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: color.silk, fontSize: font.lead, fontWeight: '600' }}>{title}</Text>
        {/* Green, like the browser's: each of these is a live answer rather
            than small print, and `ok` is already what both apps use for a
            thing said in words they are sure of. */}
        {status ? (
          <Text numberOfLines={1} style={{ color: color.ok, fontSize: font.small }}>
            {status}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: color.silkFaint, fontSize: font.lead }}>›</Text>
    </Pressable>
  )
}

/**
 * How big the stage tiles are.
 *
 * Five steps, the browser's own, because they are about a thumb rather than
 * about a window: Smallest is for somebody who wants the whole rig on one
 * screen and Largest for somebody playing in the dark. Kept under the same key
 * as the browser's, so a phone and a laptop on one account agree.
 */
/**
 * Stage tiles: a stepper and a tick box, the same two controls as the browser.
 *
 * "Update the mobile app's tile size screen to look like this with the +/-
 * buttons instead of the tab buttons."
 *
 * Five buttons in a wrapping row said five things at once and took two lines
 * to do it. A stepper says the one thing that matters — what it is set to
 * now — and the two ways to change it sit either side of the answer.
 *
 * FIT IS A TICK BOX UNDER IT, NOT A SIXTH STEP, because it is not a size: it
 * is the screen deciding instead of you. While it is on the stepper reads
 * "Fit to screen" and its buttons go quiet, which is the honest way to show a
 * control whose value is being overridden — greying them says "not now"
 * where hiding them would say "never".
 *
 * On out of the box. It is the right answer for everybody who has not got an
 * opinion yet, which is everybody on the first launch.
 */
function TileSize({ onScrollLock }) {
  useStored()
  const now = loadSize(sync)
  const fit = loadFit(sync, true)
  const icons = loadIcons(sync)
  const layout = loadSceneLayout(sync)
  const step = (by) => saveSize(clampSize(now + by), sync)
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Press
          label="−"
          accessibilityLabel="Smaller tiles"
          height={TAP}
          disabled={fit || now <= 0}
          style={{ paddingHorizontal: space.lg }}
          onPress={() => step(-1)}
        />
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            color: color.silk,
            fontSize: font.lead,
            fontWeight: '700'
          }}
        >
          {fit ? 'Fit to screen' : SIZES[now]?.name || SIZES[0].name}
        </Text>
        <Press
          label="+"
          accessibilityLabel="Bigger tiles"
          height={TAP}
          disabled={fit || now >= SIZES.length - 1}
          style={{ paddingHorizontal: space.lg }}
          onPress={() => step(1)}
        />
      </View>
      <Note>
        Bigger tiles are easier to hit without looking; smaller ones fit more of the rig on screen.
        This device remembers it.
      </Note>
      <Choice
        on={fit}
        label="Fit everything on one screen"
        sub="Sizes the scenes and effects so the whole rig is on screen at once, with no scrolling. Bigger presets get smaller buttons, never under a thumb’s width. Overrides the size above while it is on."
        onPress={() => saveFit(!fit, sync)}
      />
      {/* "Is it something that could be turned on and off?" */}
      <Choice
        on={icons}
        label="Show effect pictures"
        sub="A small picture on each effect in the chain — a flame for drive, a wave for chorus — above its letters. Off leaves the letters alone."
        onPress={() => saveIcons(!icons, sync)}
      />
      {/*
        WHERE THE SCENES SIT. "Make an option in settings to select on the left
        side one, two, three, four for the scenes, and on the right side five,
        six, seven, eight, instead of them just going across like a snake."
        One choice of four, not four boxes: only one of them can be true.
      */}
      <Section>Scene layout</Section>
      {SCENE_LAYOUTS.map((l) => (
        <Choice
          key={l.id}
          role="radio"
          on={layout === l.id}
          label={l.name}
          sub={l.sub}
          onPress={() => saveSceneLayout(l.id, sync)}
        />
      ))}
      {layout === 'mine' ? <ArrangeScenes onScrollLock={onScrollLock} /> : null}
    </View>
  )
}

/**
 * ARRANGE SCENES, for "My own order".
 *
 * "And actually, can you make it so you can grab and drop the scenes wherever
 * you want them on the screen? Because that would be cool." Here rather than
 * on Play, so a mis-drag mid-song cannot happen. One order for every preset;
 * a preset with fewer scenes keeps the ones it has in the same order, and
 * gigSize mends the rest.
 */
function ArrangeScenes({ onScrollLock }) {
  const order = loadSceneOrder(sync)
  return (
    <View style={{ gap: space.md }}>
      <Section>Arrange scenes</Section>
      <Note>Tap a scene, then tap the one to swap it with. Or drag one onto another. This order is used for every preset.</Note>
      <SceneArrange order={order} onChange={(next) => saveSceneOrder(next, sync)} onScrollLock={onScrollLock} />
      <Press label="Put them back in order" onPress={() => saveSceneOrder([0, 1, 2, 3, 4, 5, 6, 7], sync)} />
    </View>
  )
}

/**
 * A tick box with a sentence under it.
 *
 * The browser has a real checkbox and this end has none, so it is drawn:
 * a square that fills when it is on, the way the one on the computer does.
 * `accessibilityRole` is checkbox rather than button, because that is what it
 * is — a screen reader should say "checked", not "selected".
 */
function Choice({ on, label, sub, onPress, role = 'checkbox' }) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: !!on }}
      accessibilityLabel={label}
      onPress={() => {
        tick()
        onPress?.()
      }}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radius.sm,
          borderWidth: on ? 0 : 1,
          borderColor: color.rule,
          backgroundColor: on ? color.signal : color.panel,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {on ? (
          <Text style={{ color: color.onSignal, fontSize: font.body, fontWeight: '700' }}>✓</Text>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <Text style={{ color: color.silk, fontSize: font.body }}>{label}</Text>
        <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: font.small * 1.5 }}>
          {sub}
        </Text>
      </View>
    </Pressable>
  )
}

function Section({ children }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: color.silkFaint,
        fontSize: font.micro,
        letterSpacing: 1.5,
        textTransform: 'uppercase'
      }}
    >
      {children}
    </Text>
  )
}

/**
 * What deleting the account does to the full version, by where it came from
 * (RevenueCat's store name; see purchases.js, unlockedFrom). A store purchase
 * stays with the Apple ID or Google account that paid; a website purchase and
 * a gift belong to the account, and go with it. Said without naming the
 * website, as the phone's other words about paying are (Apple 3.1.3).
 */
const deleteCosts = (from) => {
  const mine = Platform.OS === 'ios' ? 'Apple ID' : 'Google account'
  if (['RC_BILLING', 'STRIPE', 'PADDLE'].includes(from)) {
    return `Your full version belongs to this account, not to your ${mine}, so deleting the account gives it up for good: Restore can’t bring it back.`
  }
  if (from === 'PROMOTIONAL') {
    return 'The full version was given to this account, so deleting the account gives it up for good.'
  }
  /* Not known yet, or not known at all: both ways, rather than the store's
     promise to somebody it may not be true for. */
  if (!from) {
    return `If you paid for the full version with your ${mine}, it stays with your ${mine}, and Restore a purchase brings it back on a new account. If it came to this account any other way, deleting the account gives it up for good.`
  }
  /* Bought through the other phone's store: said without naming it, which
     an iPhone may not do (Apple 2.3.10). */
  const here = Platform.OS === 'ios' ? ['APP_STORE', 'MAC_APP_STORE'] : ['PLAY_STORE']
  if (!here.includes(from)) {
    return 'The full version you bought stays with the store account you paid with. Restore a purchase on the phone or tablet you bought it on brings it back on a new account.'
  }
  return `The full version you bought stays with your ${mine}. Restore a purchase brings it back on a new account.`
}

/** A heading and the rows under it — one group of Settings. */
function Group({ title, children }) {
  return (
    <View style={{ gap: space.xs }}>
      <Section>{title}</Section>
      <View style={{ gap: 0 }}>{children}</View>
    </View>
  )
}

/**
 * Who this is, at the top of Settings: the account, and whether the app is
 * the full version. Tapping it opens the Account page — signing in and out,
 * the password, unlocking or restoring a purchase.
 */
/*
 * The account line for a sign-in the phone holds and the account service
 * has not vouched for, said in place of the password and account options it
 * cannot offer: no signal at a gig, most often. See `kept` in Settings.
 *
 * NOT "NO INTERNET". It said that for a day, but the account service says
 * nobody with a signal too: in an outage, and for the minute after the
 * signal comes back while supabase-js holds on to its failed renewal. A
 * customer on working wifi was told they had no internet. What is true in
 * every one of those is that the account cannot be reached.
 */
const KEPT_OFFLINE = 'Can’t reach your account now. Password and account options come back when it can.'

/*
 * `email` is the account service's, or the one kept on the phone while it
 * has not vouched for it (`offline`), which is up at once rather than after
 * "Checking…": with no signal the service takes up to twenty-five seconds to
 * say nothing.
 */
function AccountCard({ asked, email, offline, paired, unlocked, demo, onPress }) {
  const who = email || (!asked ? 'Checking…' : paired ? 'Paired, no account' : 'Not signed in')
  const what = demo ? 'Demo' : unlocked ? 'Full version' : 'Not unlocked yet'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Account, ${who}, ${what}`}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.rule,
        backgroundColor: pressed ? color.panelHi : color.panel
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} ellipsizeMode="middle" style={{ color: email ? color.silk : color.signal, fontSize: font.lead, fontWeight: '600' }}>
          {who}
        </Text>
        <Text numberOfLines={1} style={{ color: color.ok, fontSize: font.small }}>
          {`${what} · v${APP_VERSION}`}
        </Text>
        {/* Said on the card, so Delete account is found from the first page
            of Settings rather than guessed at (Apple 5.1.1(v)). Not for a
            sign-in only the phone vouches for: none of that works offline. */}
        {email ? (
          <Text numberOfLines={offline && asked ? 2 : 1} style={{ color: color.silkDim, fontSize: font.micro }}>
            {offline ? (asked ? KEPT_OFFLINE : 'Checking…') : 'Password, sign out, delete account'}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: color.silkFaint, fontSize: font.lead }}>›</Text>
    </Pressable>
  )
}

/**
 * Light, dark, or the handset's own setting.
 *
 * Auto first, then Light and Dark. Dark is the default since 18 October
 * 2026 ("Can we make the default dark mode on the app?"): the stage is dark,
 * and a phone set to light came up on the paper theme there. Auto still
 * follows the handset for anybody who picks it.
 */
function Appearance() {
  const [mode, setLocal] = useState(getMode())
  const LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' }
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {MODES.map((m) => (
        <Press
          key={m}
          grow
          label={LABEL[m]}
          tone="signal"
          on={m === mode}
          height={TAP}
          onPress={() => {
            setMode(m, sync)
            setLocal(m)
          }}
        />
      ))}
    </View>
  )
}
