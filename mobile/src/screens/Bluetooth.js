import { useEffect, useMemo, useRef, useState } from 'react'
import { Linking, Platform, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { color, font, mono, radius, space } from '../lib/theme'
import { classic } from '../lib/glass'
import { APP_VERSION } from '../lib/version'
import { BLE_UNITS, WAYS } from '../lib/bleWire'
import {
  ALLOW_WORDS,
  APPLE_SCREEN_OPENS,
  RESTRICTED_WORDS,
  adapterAway,
  adapterBeforeCable,
  adapterDevices,
  adapterInsteadOfCable,
  adapterKeptFor,
  adapterName,
  adaptersForOtherUnits,
  cableAway,
  cablesConnectTakes,
  cablesHere,
  cablesToOffer,
  checkSteps,
  chooseAdapter,
  chooseCableHere,
  connectOwedUntil,
  editOverBluetooth,
  findAdapters,
  forgetAdapter,
  forgetAdapterFor,
  glanceForAdapters,
  letGoOfKeptAdapter,
  lookForAdapterAgain,
  methodsFor,
  midiJacks,
  offeredUnits,
  onAdapter,
  otherAdapterNow,
  otherAdapterWords,
  pairScreenShut,
  refreshAdapters,
  refreshOnScreen,
  runCheck,
  setBluetooth,
  setBluetoothUnit,
  setMethods,
  stopPageWait,
  switchAdapter,
  turnOnBluetooth,
  unitName,
  useBluetooth,
  useBluetoothAdmin,
  useWaitingForBluetooth
} from '../lib/bluetooth'
import { connectBluetoothAgain } from '../lib/bleLink'
import { editingLine, limitsLine } from '../lib/editWords'
import {
  AMAZON_DISCLOSURE,
  BLUETOOTH_WAYS,
  CLOSE_AND_REOPEN,
  CONNECT_AGAIN,
  CONNECT_AGAIN_SUB,
  FIRST_TIME,
  FIRST_TIME_ADAPTER,
  FM3_NEVER,
  GUIDE_URL,
  NOT_FOR_FM3,
  ONE_AT_A_TIME,
  PARTS,
  PLUGS_CHECK,
  POWER_LINE,
  REPORT_BUTTON,
  SELLERS_LINE,
  REPORT_NOTE,
  SWITCH_TO,
  SWITCH_TO_SUB,
  TROUBLE_LIT,
  TRIED_NOTES,
  TURN_ON_BLUETOOTH,
  VP4_CANT_HEAR,
  VP4_CONNECTED,
  VP4_OVER_BLUETOOTH,
  adapterOfUnit,
  appleListForget,
  bluetoothOffHint,
  bluetoothOffLine,
  firmwareLineFor,
  hookupFor,
  midiSettingsFor,
  missingBlocksLine,
  namedForFm3,
  notAnAdapter,
  notAnsweringLine,
  untried,
  unitForReport,
  warningFor,
  swapLine,
  waysFor,
  wrongAdapterLine,
  wrongUnitLine
} from '../lib/bluetooth-gear'
import { cablesIn, isCable } from '../lib/bleAdapters'
import {
  CABLE_AWAY,
  CABLE_CLOSE_AND_REOPEN,
  CABLE_CONNECTING_HINT,
  CABLE_ROW,
  CABLE_ROW_AWAY,
  CABLE_TO_ADAPTER,
  CABLE_TO_ADAPTER_SUB,
  CABLE_USE_HERE,
  CABLE_VP4_CANT_HEAR,
  CABLE_VP4_CANT_HEAR_JACKS,
  cableAwayHint,
  cableConnectingLine,
  cableKeptHint,
  cableListedHint,
  cableStatus,
  cableSteps,
  FM3_CABLE_WAY,
  fm3CableLine,
  leaveWords
} from '../lib/cableWords'
import { deviceNoun } from '../lib/device-word'
import { probeNow } from '../lib/link'
import { useRig } from '../lib/rig'
import { mayDriveBluetooth } from '../lib/unlock-rule'
import Note from '../components/Note'
import Press from '../components/Press'
import bluetoothIcon from '../../assets/icons/bluetooth.png'

/**
 * Settings → Bluetooth.
 *
 * The phone talking straight to the unit, through a Bluetooth MIDI adapter
 * plugged into the unit's MIDI In and Out, with no computer anywhere.
 *
 * CONNECT FIRST, AND THE READING FOLDED UNDER IT. "Will you move the connect
 * button up closer to the top? There's a lot of scrolling to figure out
 * what's going on there ... it's very messy and confusing right now. It would
 * be cool if, like, a five-year-old could connect it." (24 October 2026.)
 * The beta note and a paragraph came first, then the unit, then What you
 * need, open for a first setup, so Connect sat under a shopping list. Now the
 * page opens on one big line saying where it stands, then the unit and
 * Connect (Stop, once it is on), all on the first screen; what is read once
 * is in rows under it that open when tapped.
 *
 * TWO STEPS AND ONE BUTTON. "Setting up the Bluetooth is kind of weird. A lot
 * of different buttons to press. Maybe we can make it a little easier. It was
 * very confusing for me, but I did figure it out finally." The first version
 * had a switch, a unit, a Find button, a list with a Use this one in every
 * row, Connect, Disconnect and Forget, and they had to be pressed in the
 * right order. Now: 1, which unit; 2, Connect. Connect opens Apple's
 * Bluetooth screen (or looks, on Android), picks the adapter itself when only
 * one could be meant (lib/bluetooth's pickAdapter), and turns Bluetooth on.
 * The list only appears when there is a real choice to make. Once it is on,
 * the one button is Stop, which hands the phone back to the computer.
 *
 * HOW TO PLUG IT IN, WHAT TO BUY, AND WHAT IT CAN AND CAN'T DO, each a row
 * under Connect, for the unit picked in step 1 (lib/bluetooth-gear, from
 * shared/bluetooth-gear.mjs, which the website's guide is held to as well).
 * How to plug it in is open until an adapter has been used, because nothing
 * connects until it is plugged in; the other two wait to be tapped.
 *
 * NOT A BETA since 26 October 2026 ("remove anything that says beta on it
 * for Bluetooth"). Justin's account's on every copy, and a customer's on a
 * copy whose built-in store version opens it (lib/ble-rule.js, from 1.89.0):
 * Settings draws this page for nobody else (useBluetoothAllowed,
 * lib/bluetooth.js).
 *
 * TWO WAYS TO CONNECT, BLUETOOTH FIRST. Since 7 November 2026 ("make sure
 * it's Bluetooth first as far as connection options go"), with no ranking:
 * Bluetooth needs no computer, and a computer has less lag and more
 * features (BLUETOOTH_WAYS in shared/bluetooth-gear.mjs, and CLAUDE.md "How
 * it is presented"). It replaced his 25 October rule that the computer was
 * the preferred way.
 *
 * EVERY UNIT, AND NOTHING OF WHICH HAVE BEEN TRIED. Step 1 offers what
 * lib/bluetooth says this account may pick (offeredUnits): all five on a
 * copy that opens Bluetooth to customers, as on his account. Whether a unit
 * or a way was tried is said nowhere a player reads, since 31 October 2026:
 * "we just need to keep track of it ourselves in the developer menu so that
 * we can confirm it or if someone leaves us a note saying it doesn't work
 * then we can investigate" (Justin). It is drawn on Developer → App health
 * → Tried (BluetoothTried, below), and the head of every log says it. And
 * everybody, before any pick and whatever is picked, is told the cable is
 * never for an FM3 (NOT_FOR_FM3): "The FM three is the only one that ever
 * has overheating issues" (the same day), so no other unit has a heat
 * check.
 *
 * A VP4 IS SENT PRESETS AND SCENES, AND HEARD NOT AT ALL (lib/bleVp4.js). So
 * its connected line says the adapter is connected and the phone is sending
 * (VP4_CONNECTED), never that it is answering, with why under it
 * (VP4_CANT_HEAR); What it can and can't do says what it gets
 * (VP4_OVER_BLUETOOTH); and it has no testing tools, which have nothing to
 * ask it.
 *
 * AND ONE TAP TO SAY SO. "Super easy for all users to submit bugs and
 * feedback" (25 October 2026, when Bluetooth (beta) was decided for every
 * customer with the full version): a big Report a Bluetooth problem over
 * the note at the foot, on every visit, and a small Report this beside each
 * line that says something is wrong, which sends that line with the report.
 * Not beside the line that says Bluetooth is not allowed, which has Open
 * Settings, the fix, under it, and not beside "Unlock the app", which is not
 * a problem with Bluetooth. Both open the report screen (screens/Report,
 * `onReport`, App's through Settings) with what is wrong said on it, which
 * comes back here.
 *
 * The note at the foot (REPORT_NOTE) names no phone, so Apple's 2.3.10,
 * which keeps other phones' names out of an iPhone app, has nothing to find
 * on the page the review notes send Apple's reviewer to.
 *
 * THE DEVICE IN HAND, BY ITS NAME (lib/device-word deviceNoun): an iPad or a
 * tablet reads "this iPad", "the tablet's settings", never "this phone".
 *
 * A UNIT ON A USB CABLE IS SAID AS ONE. "I've already used my iPhone and it
 * does connect. It just says it's a Bluetooth connection and not USB, even
 * though it is USB." (Justin, 3 November 2026.) The page is still the
 * Bluetooth page, and Connect is still the one button, but with a unit
 * plugged in by USB cable (lib/bleAdapters isCable) Connect uses it straight
 * away, with no Apple's screen and nothing about Bluetooth asked
 * (lib/bluetooth findAdapters), when nothing else could be meant: no
 * Bluetooth adapter connected beside it, not one Forgotten by hand, not one
 * named for another unit than the one picked, and never in place of an
 * adapter kept from last time (bleAdapters cablesFirst). Every line that
 * says how it is connected says the cable (lib/cableWords): the big line,
 * the hints, the list and Troubleshooting, with the MIDI plug checks kept
 * for a USB MIDI cable on the unit's MIDI jacks (lib/bluetooth midiJacks).
 * No Reconnect for one: plugging it back in is what brings it back. No
 * cable way to buy. The FM3 cannot be plugged in by its USB port at all,
 * but can by a USB MIDI cable on its MIDI ports, the U2MIDI Pro, and says
 * both when it is picked on a copy where a unit can plug in by cable
 * (lib/bluetooth cablesHere; lib/cableWords fm3CableLine), beside its own
 * red warning, which is unchanged.
 *
 * USE THE USB CABLE. "Lots of issues connecting FM3 with U2midi pro.
 * Finally did connect though, need better way to select that when FM3 is
 * selected in the connection page" (Justin, 9 November 2026, iPad): Connect
 * went to the WIDI Uhost kept from last time, the link tried it for ever
 * with the cable plugged in beside it, and the cable was reached only
 * through Apple's screen. So a cable plugged in now that Connect is not
 * using is offered by its own name, one tap (lib/bluetooth cablesToOffer,
 * chooseCableHere): off, under Connect; on, while the adapter kept is not
 * there or the unit says nothing through it.
 *
 * The check, for finding out what a real unit does, is folded away under
 * Testing tools, last.
 *
 * THE CHECK IS FOR TESTING, and says so. Nobody here has every unit to try
 * it on, so where a unit might ignore a command both ways of sending it are
 * in here; the check tries them, shows the bytes that went out and came
 * back, and remembers what worked. "How each command is sent" can force
 * either. Rough edges are deliberate: it is a bench instrument.
 *
 * AND ONLY JUSTIN SEES IT (`admin`, which Settings works out with isAdmin
 * from shared/admin.mjs, the same as his Developer pages). Apple's 2.2:
 * "Demos, betas, and trial versions of your app don't belong on the App
 * Store", and a reviewer once called a visible test button a "Beta feature"
 * not fit for release. A button any customer could open, saying "For
 * testing." and offering Write checks that change the unit, is that button.
 * Nothing a customer needs lives in it: every command goes Auto, which
 * tries the first way, checks, and remembers what worked, in ordinary use
 * as much as in the check; and an AM4 has one way for each and never had
 * the choices at all.
 *
 * Drawn inside Settings' own scroll view, under its head: no scroll view and
 * no Done of its own.
 */

const face = Platform.select(mono)
const ios = Platform.OS === 'ios'

/*
 * What a player loses by leaving the cable at home, in the order it is
 * noticed. Editing first, said for the unit picked (lib/editWords
 * editingLine, by the switch Play's Edit asks, lib/bluetooth
 * editOverBluetooth): closed, "No editing or saving over Bluetooth.", what
 * every customer copy shows until a store version opens editing on the
 * unit; open, what Edit does there and that nothing saves.
 */
const DIFFERENT = [
  'Slower to load the preset list.',
  'Footswitch changes may take a moment to show.',
  'About 30 feet of range.',
  'The adapter connects to one thing at a time.',
  'On the AM4, scene names take a moment the first time a preset is seen.',
  /* lib/gen3-edit: there is no cab state over Bluetooth, so a cab is not picked there. An AM4's is. */
  'On the FM3, FM9 and Axe-Fx III, a cab is chosen with the computer.',
  /* Found by their absence until this line: every one of them is hidden over Bluetooth, not broken. */
  'No looper, volume button, unit metronome click or Footswitches page.'
]

/* The panel's choices, in the order the panel lists them. */
const HOW = [
  { key: 'scene', name: 'Scene' },
  { key: 'channel', name: 'Channel' },
  { key: 'tempo', name: 'Tempo' },
  { key: 'preset', name: 'Preset' },
  { key: 'tuner', name: 'Tuner' }
]
const WAY_NAMES = { auto: 'Auto', published: 'Published', edit: 'FM3-Edit’s', sysex: 'SysEx', pc: 'Program Change', poll: 'Poll', push: 'Push' }

/* Android reports how loud each adapter is; a word reads better than a number. */
const signal = (rssi) => (!Number.isFinite(rssi) ? '' : rssi > -60 ? 'strong signal' : rssi > -80 ? 'fair signal' : 'weak signal')

/**
 * Whether it is working, in one plain line, and how it should look: the
 * unit's own answer decides "working", the same as the bar does over the
 * computer, because a connected adapter on a unit that says nothing is not
 * working.
 */
function status(b, unitState) {
  const name = unitName(b.unit)
  const cable = isCable(b.adapter)
  /* A USB MIDI cable on the unit's MIDI jacks: not answering is its plugs first, as for an adapter (lib/bluetooth midiJacks). */
  const jacks = cable && midiJacks(b.adapter)
  /* Whatever the switch says: finding the adapter before turning this on is the usual order, and a search that could not start has to say why. */
  /* Android only (nothing sets it on an iPhone), with Turn on Bluetooth under it (bluetoothOffLine, TURN_ON_BLUETOOTH). */
  if (b.trouble === 'bluetooth-off') return { line: bluetoothOffLine(deviceNoun()), tone: 'fault' }
  if (b.trouble === 'permission') return { line: ALLOW_WORDS, tone: 'fault' }
  if (b.trouble === 'restricted') return { line: RESTRICTED_WORDS, tone: 'fault' }
  if (!b.on) return { line: 'Not connected', tone: 'dim' }
  if (b.phase === 'locked') return { line: 'Unlock the app to connect to your unit', tone: 'fault' }
  if (!b.unit || b.phase === 'no-unit') return { line: 'Pick your unit', tone: 'dim' }
  if (!b.adapter || b.phase === 'no-adapter') return { line: 'No adapter yet. Tap Stop, then Connect.', tone: 'dim' }
  if (b.phase === 'held') return { line: 'Disconnected', tone: 'dim' }
  if (b.phase === 'connected') {
    /*
     * The wrong unit on the adapter: which one really answered, by name, and
     * the way out (shared/bluetooth-gear wrongUnitLine). Any unit the wire
     * knows: an AM4 on another unit's connection (which also stops the wire
     * sending), an FM9 picked as an FM3, an FM3 on the AM4's, a VP4 on
     * anybody's. Sent to step 1 only for a unit this account can pick there.
     */
    if (b.answeredAs) {
      const units = offeredUnits()
      const pickable = units.some((u) => u.name === b.answeredAs)
      /*
       * By the adapter's name, when the unit that answered can be picked
       * here: "The WIDI Jack is on an AM4, not your FM3", with Switch to
       * under it, one tap on the same connection (switchUnit, below). Not
       * for a unit on a USB cable, which is the unit itself.
       */
      if (pickable && !cable && adapterName(b.adapter) && carriesTo(b.answeredAs, b.adapter)) return { line: wrongAdapterLine({ adapter: adapterName(b.adapter), answered: b.answeredAs, picked: name }), tone: 'fault' }
      return { line: wrongUnitLine({ answered: b.answeredAs, picked: name, pickable }), tone: 'fault' }
    }
    /* A unit on a USB cable: the same lines, saying the cable (lib/cableWords cableStatus), a VP4's still never answering. */
    if (cable) return cableStatus({ unit: b.unit, name, unitState, jacks })
    /* A VP4 never answers over Bluetooth (lib/bleVp4.js): connected is the adapter, and the phone sending. */
    /* A footswitch taken for the adapter (shared/bluetooth-gear notAnAdapter): said for every unit, the VP4 too, which never answers and so would read as connected. */
    if (notAnAdapter(b.adapter?.name)) return { line: notAnsweringLine(b.unit, b.adapter?.name), tone: 'fault' }
    if (b.unit === 'vp4') return { line: VP4_CONNECTED, tone: 'ok' }
    if (unitState === 'present') return { line: `Connected · ${name} answering`, tone: 'ok' }
    /* The usual reasons, by unit (shared/bluetooth-gear notAnsweringLine): the Axe-Fx III has no MIDI Thru setting, only a THRU jack the white plug must stay out of. */
    if (unitState === 'missing' || unitState === 'silent') return { line: notAnsweringLine(b.unit, b.adapter?.name), tone: 'fault' }
    return { line: `Connected · asking the ${name}…`, tone: 'dim' }
  }
  if (cable) return { line: cableConnectingLine(b.adapter?.name), tone: 'dim' }
  return { line: `Connecting to ${b.adapter?.name || 'the adapter'}…`, tone: 'dim' }
}

/*
 * WHETHER THE PAGE MAY OFFER THE UNIT THAT ANSWERED ITS ADAPTER (Switch to):
 * any unit, but an FM3 only on an adapter the app names for one, the WIDI
 * Uhost (shared/bluetooth-gear namedForFm3). The FM3 rule: the WIDI Master
 * and the C2MIDI Pro are never offered for an FM3. With any other on an
 * FM3, the page says so with wrongUnitLine's Stop, pick and Connect, under
 * the red FM3 warning, and Connect lists the adapter for its owner's tap.
 */
const carriesTo = (answered, a) => answered !== 'FM3' || namedForFm3(adapterName(a))

/*
 * Blue for the unit answering over Bluetooth, as the bar is; green stays the
 * unit answering through a computer, and on a USB cable, which is not
 * Bluetooth (the bar's lamp is the plain one for it too).
 */
const TONES = { ok: () => color.ble, fault: () => color.fault, dim: () => color.silkDim }
const toneColor = (tone, cable) => (tone === 'ok' && cable ? color.ok : TONES[tone]())

export default function BluetoothPage({ purchase, admin = false, onReport = null, onOpen = null, onConnected = null }) {
  const b = useBluetooth()
  const unitState = useRig((s) => s.unit)
  const said = status(b, unitState)
  /*
   * The units on a USB cable plugged in now, which Connect uses before
   * anything about Bluetooth, and whether the one chosen is on a cable
   * (lib/bleAdapters isCable): by what is kept, or, for one kept as its id
   * and name alone before 1.89.27, by the list until it connects and the
   * kept one learns its driver (lib/bluetooth refreshKeptAdapter).
   *
   * READ ONCE PER CHANGE, NOT AT EVERY REDRAW: when the page opens, and when
   * the list, the adapter or the switch moves. On an iPhone the first read
   * makes the module's MIDI client (which asks iOS nothing: it is not
   * Bluetooth, and the module's own header keeps it for a phone that opens
   * this page), and with Android's USB build it is a call into Android's
   * MIDI service; neither is asked again by a page left as it is.
   *
   * AND AT A PLUG-IN, while the page is open: the module's list moves
   * (onDevices: CoreMIDI's setup on an iPhone or iPad, Android's USB MIDI
   * service), and nothing in Bluetooth's snapshot does, with Bluetooth off
   * and no search running. A U2MIDI Pro plugged in after the page opened
   * then got no Use the USB cable, and Connect went to Apple's screen, as in
   * bug 8519c338, until the page was left and opened again. So the page
   * counts the module's lists while it is open (`plugs`), and reads again on
   * each. Listening asks iOS and Android nothing about Bluetooth; never
   * through the search's listener, which would fill b.devices and draw its
   * rows.
   */
  const [plugs, setPlugs] = useState(0)
  useEffect(() => onAdapter('onDevices', () => setPlugs((n) => n + 1)), [])
  const listed = useMemo(() => adapterDevices(), [b.devices, b.adapter?.id, b.on, b.phase, b.notThere, b.unit, plugs])
  const cables = cablesIn(listed)
  const cable = !!b.adapter && (isCable(b.adapter) || cables.some((d) => d.id === b.adapter.id))
  /* A USB MIDI cable on the unit's MIDI jacks, whose plugs can be swapped (lib/bluetooth midiJacks): the plug checks stay. */
  const jacks = cable && midiJacks(b.adapter)
  /* The cables a tap on Connect takes straight away (lib/bluetooth cablesConnectTakes), so the hint under it says what it does. */
  const takes = cablesConnectTakes(listed)
  /* The adapter kept is not plugged in or connected now, by the list as read: for what is drawn (offlineHere, below, asks afresh for a tap). */
  const offlineInList = (a) => {
    const seen = listed.find((d) => d.id === a.id)
    return !seen || !!seen.offline
  }
  /*
   * REPORT THIS, beside what is wrong: a fault line, except the one with
   * Open Settings under it and the one about unlocking. When the adapter is
   * connected and the unit says nothing, it goes under the hint that says
   * why, rather than between the line and its hint.
   */
  const quiet = b.on && b.phase === 'connected' && !b.answeredAs && (unitState === 'missing' || unitState === 'silent')
  /* Not beside Bluetooth off either, which has Turn on Bluetooth under it: it is not a fault in the app. */
  const reportable = said.tone === 'fault' && b.trouble !== 'permission' && b.trouble !== 'bluetooth-off' && b.phase !== 'locked' && !!onReport
  const connected = b.on && b.phase === 'connected'
  /*
   * CONNECTED TO A FOOTSWITCH, NOT AN ADAPTER (notAnAdapter): none of the
   * not-answering help fits (Connect again only reconnects to it, the plugs
   * are not the trouble), and the way out is Use a different adapter, under
   * the line that says so.
   */
  const footswitch = connected && !b.answeredAs && !cable && notAnAdapter(b.adapter?.name)
  /* The units step 1 offers this account (lib/bluetooth offeredUnits). */
  const units = offeredUnits()
  const vp4 = b.unit === 'vp4'
  /* Where it stands, in one big line: drawn while it is on, or when something is wrong. Off and fine, the steps are the first thing on the page. */
  const sayIt = b.on || !!b.trouble || said.tone === 'fault'

  /*
   * CONNECT. With an adapter from last time, that is all it does: Bluetooth
   * on. Without one it goes and finds it, and Bluetooth comes on the moment
   * one is chosen — by the phone when only one could be meant, or by a tap
   * in the list when there is a real choice. `wanted` is that promise, kept
   * until an adapter arrives.
   */
  /*
   * The promise is the tap's, for the unit it was tapped for (`wanted` is
   * that unit): another unit picked meanwhile, whose own adapter arrives
   * with it (each unit keeps its own), turns nothing on.
   *
   * And from the start when the page opens within two minutes of a Connect
   * on an earlier visit that found Bluetooth off, with nothing kept
   * (lib/bluetooth connectOwedUntil): the look that starts once it is on
   * chooses the adapter, and this turns Bluetooth on with it, as that
   * Connect would have. Never for a Connect older than that, so nothing
   * switches anybody off the computer without a tap.
   */
  const [wanted, setWanted] = useState(() => (connectOwedUntil() !== null && !b.adapter ? b.unit : null))
  /* Apple's screen closed with no adapter connected in it. */
  const [missed, setMissed] = useState(false)
  /* The full version as Bluetooth reads it: the purchase itself for a customer, never "the store cannot be reached" (unlock-rule mayDriveBluetooth). */
  const his = useBluetoothAdmin()
  const paid = mayDriveBluetooth(purchase, his)
  useEffect(() => {
    if (!wanted || !b.adapter || !b.unit || b.on) return
    setWanted(null)
    if (paid && wanted === b.unit) setBluetooth(true)
  }, [wanted, b.adapter?.id, b.unit, b.on, paid])

  const canStart = !!b.unit && paid
  /* Apple's screen kept shut (iOS 27, before the build with Apple's fix): no hint sends anybody to it. */
  const shut = pairScreenShut()
  /* `cableFirst: false` when a Bluetooth adapter is what is looked for (another, below): Apple's screen, never a cable in its place (lib/bluetooth findAdapters). */
  const find = async ({ cableFirst = true } = {}) => {
    setMissed(false)
    setWanted(b.unit)
    const pick = await findAdapters({ cableFirst })
    if (ios && !pick && !adapterDevices().some((d) => !d.offline)) setMissed(true)
  }
  /*
   * Another adapter: forget this one, then the same as the first time, with
   * Apple's screen. Only ever for a Bluetooth adapter kept from last time
   * that has gone (start, below): a cable plugged in meanwhile is not taken
   * in its place, or the adapter could never be connected again with the
   * cable in. The one connected in Apple's screen is taken first
   * (pickAdapter), and with none connected there, the only port left.
   */
  const another = () => {
    if (!canStart) return
    forgetAdapter()
    find({ cableFirst: false })
  }
  /*
   * ON AN IPHONE, AN ADAPTER FROM LAST TIME THAT IS NOT CONNECTED TO IT NOW
   * goes through Apple's screen again. Apple's screen is the only way an app
   * can connect one, and turning Bluetooth on with it offline only waited
   * for it to come back by itself, under a hint telling the player to tap
   * Connect and use Apple's screen — which Connect never opened.
   */
  const offlineHere = (a) => {
    const seen = adapterDevices().find((d) => d.id === a.id)
    return !seen || !!seen.offline
  }
  /*
   * ONE CONNECT, WHATEVER IS ON THE ADAPTER. "Right now it shows WIDI Uhost
   * or connect other device. Maybe we can get rid of that since it can
   * detect what device is connected to Bluetooth already, but it should pull
   * up the connection box allowing it to connect when they hit connect"
   * (Justin, 26 October 2026). So the button says Connect and nothing else:
   * the adapter from last time when it is there, Apple's screen (or the
   * search, on Android) when it is not.
   *
   * A DIFFERENT ADAPTER IS ITS OWN BUTTON, under Connect and above Stop,
   * since 3 November 2026: "Where is the button to change Bluetooth
   * adapters. I have a widi jack connected", and "It was trying to only let
   * me connect to a Widi master cause that's what I connected to previously
   * and I had a widi jack hooked up now" (Justin, Android). Connect went to
   * the WIDI Master kept from last time, the link tried it for ever, Stop and
   * Connect went straight back to it, and a different adapter was only
   * Troubleshooting's Forget the adapter, drawn with Bluetooth off. Now Use a
   * different adapter is drawn whenever an adapter is kept and nothing is
   * connected to it: off, or on once a try has missed it (bleLink's
   * notThere), so a join that is about to work is not one tap from being
   * dropped, and Stop is under it from the start. Bluetooth off for it,
   * the one kept forgotten (lib/bluetooth letGoOfKeptAdapter), then what
   * Connect does the first time, the search's list on Android and Apple's
   * screen on an iPhone (another, above). And while the link tries one that
   * is not there, another the phone can see is offered by name, for a tap
   * (otherAdapterNow, below). Troubleshooting's Forget the adapter does the
   * same as the button, on or off. A unit on a USB cable keeps its own,
   * Forget the USB cable.
   */
  /*
   * A UNIT ON A USB CABLE FROM LAST TIME, NOT PLUGGED IN NOW: never Apple's
   * screen, which cannot bring a cable back. With another cable plugged in
   * instead that Connect would take (lib/bluetooth cablesConnectTakes), that
   * one, found the way Connect finds one the first time (the one kept is let
   * go of, so a second cable is asked about in the list); otherwise
   * Bluetooth on, and the link connects the moment it is plugged back in
   * (bleLink heardDevices).
   */
  const cableFromLastTime = () => {
    if (cablesConnectTakes(adapterDevices()).length) {
      forgetAdapter()
      return find()
    }
    /*
     * NO CABLE PLUGGED IN AT ALL: a Bluetooth adapter, never a wait for the
     * cable. "I also got stuck where I couldn't reconnect a Bluetooth device
     * again after connecting the USB cable" (Justin, 6 November 2026,
     * Android): Connect turned Bluetooth on for the unplugged cable, the
     * link said "the USB cable is not plugged in yet" for ever, and no
     * adapter could be connected. So the adapter kept before the cable,
     * as Connect uses an adapter from last time, or, with none, the search
     * (lib/bluetooth adapterInsteadOfCable). The cable is not let go of:
     * plugged in later, it is offered as before (lib/cablePlugIn).
     */
    const back = adapterInsteadOfCable()
    if (!back) return find({ cableFirst: false })
    if (ios && offlineHere(back)) return another()
    setBluetooth(true)
  }
  const start = () => {
    if (!canStart) return
    arm()
    if (b.adapter && cable && offlineHere(b.adapter)) return cableFromLastTime()
    if (b.adapter && ios && offlineHere(b.adapter)) return another()
    if (b.adapter) setBluetooth(true)
    else find()
  }
  /* A row tapped in the list: that adapter, and on. */
  const choose = (d) => {
    arm()
    chooseAdapter(d)
    setWanted(b.unit)
  }
  /* An iPhone's row for an adapter not connected to it: Apple's screen, and whatever is connected there is taken, as by Connect. */
  const connectInApplesScreen = () => {
    if (!canStart) return
    arm()
    find({ cableFirst: false })
  }
  /*
   * ON AND TRYING AN ADAPTER THAT IS NOT THERE: a Bluetooth adapter kept, the
   * link trying it, and a try has missed it since the round began (bleLink's
   * notThere). Never for a unit on a USB cable.
   */
  const keptAdapter = !!b.adapter && !cable
  const notThere = b.on && b.phase === 'connecting' && !!b.notThere && keptAdapter
  /*
   * USE A DIFFERENT ADAPTER (A DIFFERENT ADAPTER IS ITS OWN BUTTON, above):
   * with Bluetooth off and an adapter kept, under Connect; with it on, only
   * once a try has missed the one kept (notThere), above Stop. Not while a
   * join is still going (the adapter there, the link settling), where a tap
   * would drop a join about to work, nor right after one was picked. Bluetooth
   * off and the one kept forgotten first, so the `wanted` promise turns it on
   * with the one chosen, as the first time; then the same as another(): the
   * search, never a cable in its place.
   */
  const offerDifferent = keptAdapter && canStart && (!b.on || notThere || footswitch)
  const different = () => {
    if (!canStart || !letGoOfKeptAdapter()) return
    arm()
    find({ cableFirst: false })
  }
  /*
   * ANOTHER ADAPTER HERE, while the link is trying the one kept and it is not
   * there: the one the phone can see, by name, and Use it switches to it on
   * the tap, as choosing it in the list does (lib/bluetooth switchAdapter).
   * Never by itself. To have something to see, one short look each round
   * (glanceForAdapters: the iPhone's list read, one short Android search),
   * when a try first misses: a round begins again at Stop and Connect, and
   * at a switch, so each gets its own look, and Android offers only what
   * that look heard (otherAdapterNow).
   */
  useEffect(() => {
    if (notThere) glanceForAdapters()
  }, [notThere, b.adapter?.id])
  const other = notThere ? otherAdapterNow(listed) : null
  const otherWords = other ? otherAdapterWords(b.adapter, other) : null
  const takeOther = (d) => {
    if (!canStart) return
    arm()
    switchAdapter(d)
  }
  /*
   * A BLUETOOTH ADAPTER INSTEAD OF THE USB CABLE, with Bluetooth off and a
   * cable kept: the adapter from before the cable, or the search, the cable
   * let go of as Forget the USB cable does, so Connect never takes it back
   * while it is in (lib/bluetooth adapterInsteadOfCable). "Use computer
   * instead should say use Bluetooth or computer instead" (Justin, 6
   * November 2026): a cable is never the only way the page offers.
   */
  const offerAdapterInstead = !!b.adapter && cable && canStart && !b.on
  const adapterInstead = () => {
    if (!canStart) return
    arm()
    const back = adapterInsteadOfCable({ byHand: true })
    if (!back) return find({ cableFirst: false })
    if (ios && offlineHere(back)) return another()
    setBluetooth(true)
  }
  /*
   * USE THE USB CABLE (above, A UNIT ON A USB CABLE): each cable plugged in
   * now that could be the unit picked's and is not the one chosen
   * (lib/bluetooth cablesToOffer), by its own name, for a tap. Off: unless,
   * with nothing chosen, Connect itself takes that one cable (its hint
   * already names it) or the search's list has its row. On: only while what is chosen is not working, the
   * Bluetooth adapter kept not there (notThere) or connected with the unit
   * saying nothing through it, connected to a footswitch, or a cable chosen
   * that is unplugged; never under a link that works. The tap chooses it
   * and turns Bluetooth on with it (chooseCableHere), a cable let go of by
   * hand included.
   */
  const cableAwayNow = b.on && b.phase === 'connecting' && cable && cableAway()
  const cableWanted = !b.on || notThere || (quiet && !cable) || footswitch || cableAwayNow
  /* Off with nothing chosen, already said elsewhere: the one cable Connect takes (its hint names it), or a row in the search's list. */
  const saidElsewhere = (d) => !b.on && !b.adapter && ((takes.length === 1 && takes[0].id === d.id) || b.devices.some((x) => x.id === d.id))
  const offerCables = canStart && cableWanted ? cablesToOffer(listed).filter((d) => !saidElsewhere(d)) : []
  const useCable = (d) => {
    if (!canStart) return
    arm()
    chooseCableHere(d)
  }
  const cableButtons = offerCables.map((d) => (
    <Press key={d.id} label={CABLE_USE_HERE} sub={d.name || CABLE_ROW} tone={b.on ? 'live' : undefined} height={52} disabled={b.looking} onPress={() => useCable(d)} />
  ))
  const differentButton = offerDifferent ? (
    <Press label="Use a different adapter" sub={b.on ? `Instead of ${adapterName(b.adapter) || 'the adapter'}` : `Instead of ${adapterName(b.adapter) || 'the adapter'}, from last time`} height={52} disabled={b.looking} onPress={different} />
  ) : null
  /*
   * RECONNECT, ON AN IPHONE WHOSE ADAPTER HAS GONE. An iPhone lets a
   * Bluetooth link nobody is using go after a few minutes (a phone locked
   * between songs), and the link cannot bring it back by itself: only
   * Apple's screen can (lib/bluetooth adapterAway). So while it is on and
   * away, one button opens that screen straight away (lookForAdapterAgain).
   * Not while Apple's screen is kept shut.
   */
  const away = b.on && b.phase === 'connecting' && ios && !shut && adapterAway()
  const reconnect = () => lookForAdapterAgain(probeNow)

  /*
   * SWITCH TO THE UNIT THAT ANSWERED, when another unit is on the adapter and
   * this account can pick it: one tap, on the same connection, the adapter
   * going with it as that unit's own (lib/bluetooth setBluetoothUnit
   * `carry`). Its answer is the proof of what is on the other end, so the
   * step 1 rule (no other unit picked while on) has nothing to guard here.
   */
  const answeredKey = connected && b.answeredAs ? units.find((u) => u.name === b.answeredAs)?.key || null : null
  const offerSwitch = !!answeredKey && !cable && canStart && carriesTo(b.answeredAs, b.adapter)
  const switchUnit = () => {
    if (!offerSwitch) return
    arm()
    setBluetoothUnit(answeredKey, { carry: true })
  }
  /*
   * CONNECT AGAIN, while the adapter is connected and the unit says nothing:
   * a fresh connection to it, exactly what Turn off Bluetooth and Connect
   * did for him on 7 November 2026 (lib/bleLink connectBluetoothAgain). Not
   * for a VP4, which never answers, nor a unit on a USB cable.
   */
  const offerAgain = quiet && !vp4 && !cable && !footswitch
  const again = () => {
    arm()
    connectBluetoothAgain()
  }
  /*
   * TURN ON BLUETOOTH, under the line that says it is off: Android's own
   * question (lib/bluetooth turnOnBluetooth), and the search, or the adapter
   * kept, goes on by itself once it is on. Only after Connect, or the link,
   * has found it off: nothing sets that trouble on an iPhone.
   */
  const offOnAndroid = b.trouble === 'bluetooth-off' && !ios
  /* Whether the app is waiting for it to come on: the hint promises the search, or the connection, only while it is (lib/bluetooth useWaitingForBluetooth). */
  const waitingOn = useWaitingForBluetooth()
  const turnOn = () => {
    arm()
    turnOnBluetooth()
  }
  /*
   * WHAT THE PHONE CAN SEE, READ AGAIN as the page opens and each time the
   * app is back on screen (lib/bluetooth refreshAdapters): an adapter kept
   * that Apple's screen connected again under a new id is found, and on
   * Android, with Bluetooth still said to be off (only ever after a
   * Connect), the wait for it starts again, so "once it is on, the search
   * starts by itself" holds after a visit to one of the page's own pages
   * too. The page's own wait ends with the page (stopPageWait); the link's,
   * for an adapter kept, goes on.
   */
  useEffect(() => {
    refreshAdapters()
    const off = refreshOnScreen()
    return () => {
      off()
      stopPageWait()
    }
  }, [])

  /*
   * STRAIGHT TO PLAY ONCE IT ANSWERS. "Immediately after connecting
   * Bluetooth, let's have it go to the gig screen again instead of having to
   * select done" (Justin, 27 October 2026). Only after Connect was tapped
   * here, and only once the unit answers (or, on a VP4, the adapter is
   * connected): a page opened while it is already on stays open.
   */
  const asked = useRef(false)
  const arm = () => {
    asked.current = true
  }
  useEffect(() => {
    if (!asked.current || said.tone !== 'ok' || b.answeredAs) return
    asked.current = false
    onConnected?.()
  }, [said.tone, b.answeredAs])

  /* The page's way off, for what is connected now (lib/cableWords leaveWords). */
  const stop = leaveWords({ cable, connected })
  /* The adapter kept before a cable that isn't plugged in now, which Connect then uses (cableFromLastTime). */
  const cableOut = !!b.adapter && cable && offlineInList(b.adapter) && !takes.length
  const before = cableOut ? adapterBeforeCable() : null

  /* The list is only for a real choice: no adapter chosen yet, and some to choose from. */
  const showList = !b.on && !b.adapter && b.devices.length > 0

  return (
    <View style={{ gap: space.xl }}>
      {/*
        THE STEPS FIRST, BEFORE ANY WARNING. "On the actual Bluetooth screen
        have the connect steps right there at the top before any warnings or
        anything ... It's kind of a mess and really long. It should be very
        streamlined unless there is problems" (Justin, 26 October 2026). So:
        1, the unit; 2, Connect; and under them four buttons, each to a page
        of its own. The only things drawn above the steps are what is wrong
        now, and only while it is.
      */}
      <View style={{ gap: space.lg }}>
        {sayIt ? (
          <View style={{ gap: space.sm }}>
            <Text accessibilityLiveRegion="polite" style={{ color: toneColor(said.tone, cable), fontSize: font.lead, fontWeight: '700', lineHeight: 26 }}>
              {said.line}
            </Text>
            {b.trouble === 'permission' ? <OpenSettings /> : null}
            {offOnAndroid ? <Press label={TURN_ON_BLUETOOTH} tone="live" height={52} onPress={turnOn} /> : null}
            {offOnAndroid ? <Hint>{bluetoothOffHint(b.on && !!b.adapter, waitingOn)}</Hint> : null}
            {offerSwitch ? <Press label={SWITCH_TO(b.answeredAs)} sub={SWITCH_TO_SUB(adapterName(b.adapter), b.answeredAs)} tone="live" height={52} onPress={switchUnit} /> : null}
            {reportable && !quiet ? <ReportThis onPress={() => onReport(said.line)} /> : null}
            {vp4 && connected && !b.answeredAs ? <Hint>{cable ? (jacks ? CABLE_VP4_CANT_HEAR_JACKS : CABLE_VP4_CANT_HEAR) : VP4_CANT_HEAR}</Hint> : null}
          </View>
        ) : null}
        {/*
          No "feel the adapter" for any unit but the FM3, which has its own
          warning, just below: "The FM three is the only one that ever has
          overheating issues" (Justin, 31 October 2026).
        */}
        {/*
          THE FM3, WHILE IT IS ON, AND AN FM3 THAT ANSWERED A CONNECTION MADE
          FOR ANOTHER UNIT (the one moment the app knows an adapter is plugged
          into an FM3): its warning, red, under the line that says where it
          stands. Off, with the FM3 picked, it is drawn under the units in
          step 1 instead, so it is on the page once either way.
        */}
        {(b.on && b.unit === 'fm3') || (b.answeredAs === 'FM3' && b.unit !== 'fm3') ? <Note tone="fault">{FM3_NEVER}</Note> : null}

        {b.on ? (
          <View style={{ gap: space.sm }}>
            {/*
              The usual reason a connected adapter hears nothing back: the two
              plugs swapped. An adapter that only carries one way is
              Troubleshooting's, one tap away: "It seems like there's too much
              to read everywhere you go" (Justin, 30 October 2026).
            */}
            {/* The cure that worked first, before the plugs: a fresh connection (offerAgain). */}
            {offerAgain ? <Press label={CONNECT_AGAIN} sub={CONNECT_AGAIN_SUB} tone="live" height={52} onPress={again} /> : null}
            {quiet && !footswitch && (!cable || jacks) ? <Hint>{PLUGS_CHECK}</Hint> : null}
            {/*
              STILL NOTHING AFTER THE ADAPTER WAS UNPLUGGED AND PLUGGED BACK
              IN: the way out that worked for him was closing the app
              completely (shared/bluetooth-gear CLOSE_AND_REOPEN).
            */}
            {b.phase === 'connecting' || (quiet && !footswitch) ? <Hint>{cable ? CABLE_CLOSE_AND_REOPEN : CLOSE_AND_REOPEN}</Hint> : null}
            {reportable && quiet ? <ReportThis onPress={() => onReport(said.line)} /> : null}
            {/* A unit on a USB cable: unplugged is said as unplugged, and it connects by itself when it is back (lib/bluetooth cableAway). */}
            {b.phase === 'connecting' && cable ? <Hint>{cableAway() ? CABLE_AWAY : CABLE_CONNECTING_HINT}</Hint> : null}
            {b.phase === 'connecting' && !cable ? (
              <Hint>
                {shut
                  ? 'If this stays here, tap Stop, check the adapter is plugged in and lit, then tap Connect.'
                  : away
                    ? `The adapter isn’t connected to this ${deviceNoun()} now. Check it is plugged in and lit, then tap Reconnect.`
                    : ios
                      ? 'If this stays here, tap Stop, then Connect, and connect the adapter again in Apple’s screen.'
                      : `If this stays here, check the ${deviceNoun()}’s Bluetooth is on, and that the adapter is plugged in and lit.`}
              </Hint>
            ) : null}
            {away ? <Press label="Reconnect" tone="live" sub={APPLE_SCREEN_OPENS} onPress={reconnect} /> : null}
            {/* Another adapter the phone can see while the one kept is not there: said by name, and used only on the tap (otherAdapterNow, switchAdapter). */}
            {otherWords ? (
              <View style={{ gap: space.sm }}>
                <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 22 }}>{otherWords.line}</Text>
                <Press label={otherWords.button} tone="live" height={52} disabled={!canStart} onPress={() => takeOther(other)} />
              </View>
            ) : null}
            {cableButtons}
            {differentButton}
            {/* The unit chips are not drawn while it is on: which one was picked, and how to change it. */}
            {b.unit ? <Hint>{`Unit: ${unitName(b.unit)}. Tap Stop to change it.`}</Hint> : null}
            {/* Said for what is connected now (lib/cableWords leaveWords): never "Stop using" a cable that isn't plugged in, or an adapter that isn't there. */}
            <Press label={stop.label} sub={stop.sub} height={52} onPress={() => setBluetooth(false)} />
          </View>
        ) : (
          <View style={{ gap: space.lg }}>
            {/*
              STEP 1. Only drawn while it is off: a tap here while connected
              would send the new unit's messages straight away to whatever is
              on the adapter, and the AM4 has frozen on messages it did not
              expect. Just the names (whether a unit was tried is the
              Developer page's). THE FM3'S WARNING, ONLY
              WHEN IT IS PICKED: "if they select FM3, why we wanna give the
              warning" (Justin, 26 October 2026), red, straight under the
              units and never folded (FM3_NEVER).
            */}
            <View style={{ gap: space.sm }}>
              <Heading>1 · Pick your unit</Heading>
              <UnitChips units={units} picked={b.unit} disabled={b.on} />
              {b.unit === 'fm3' ? <Note tone="fault">{FM3_NEVER}</Note> : null}
              {/* And wherever a unit can plug in by cable at all (lib/bluetooth cablesHere): not by its own USB port, which is not MIDI, but by a USB MIDI cable on its MIDI ports. */}
              {b.unit === 'fm3' && cablesHere() ? <Hint>{fm3CableLine(deviceNoun())}</Hint> : null}
            </View>

            {/* STEP 2. One button. */}
            <View style={{ gap: space.sm }}>
              <Heading>2 · Connect</Heading>
              {/*
                BIGGER, WITH ITS MARK, IN BLUETOOTH'S BLUE. "Make the connect
                under Bluetooth menu button bigger and show the Bluetooth
                symbol and change the text color to blue." (Justin, 6 November
                2026.) The mark is the Bluetooth symbol (icons/bluetooth.png),
                the one the top bar wears over Bluetooth, allowed by his
                decision the same day (TopBar BluetoothMark). Not when Connect
                reaches the unit by USB cable (the one chosen is a cable, or
                one plugged in now is what Connect takes): no picture then,
                since a cable is not Bluetooth.
              */}
              <Press label={b.looking ? 'Looking…' : 'Connect'} icon={cable || takes.length ? null : bluetoothIcon} inkColor={color.ble} labelSize={font.lead} height={64} tone="live" disabled={!canStart || b.looking} onPress={start} />
              {/* Not on iOS 27 once Connect has been tapped: the note under it then says the same, and says it louder. */}
              {shut && b.said ? null : (
                <Hint>
                  {/* A unit on a USB cable says so, and with one plugged in neither Apple's screen nor the ten-second search is promised: Connect uses the cable (lib/bluetooth findAdapters). */}
                  {!b.unit
                    ? 'Pick your unit first.'
                    : b.adapter
                      ? cable
                        ? takes.length && offlineInList(b.adapter)
                          ? cableListedHint(takes)
                          : cableOut
                            ? cableAwayHint(before ? adapterName(before) || 'the Bluetooth adapter' : null)
                            : cableKeptHint(b.adapter.name)
                        : `Uses ${b.adapter.name || 'the adapter'}, the ${unitName(b.unit)}’s adapter from last time.`
                      : takes.length
                        ? cableListedHint(takes)
                        : shut
                          ? `On iOS 27, Apple’s Bluetooth screen stays closed until the next build of the app. Connect uses an adapter that is already connected to this ${deviceNoun()}.`
                          : ios
                            ? 'In Apple’s screen, tap your adapter, wait until it says Connected, then tap Done.'
                            : `The ${deviceNoun()} looks for the adapter for ten seconds, then connects to it. If Android asks to pair, accept.`}
                </Hint>
              )}
              {cableButtons}
              {differentButton}
              {offerAdapterInstead ? <Press label={CABLE_TO_ADAPTER} sub={CABLE_TO_ADAPTER_SUB} height={52} disabled={b.looking} onPress={adapterInstead} /> : null}
            </View>
          </View>
        )}

        {/* Not under a trouble line or a note, which already say what is wrong: on iOS 27 the note says Apple's screen stayed shut, and this line would send him to it. */}
        {!b.on && missed && !b.adapter && !b.trouble && !b.said ? (
          <Text style={{ color: color.fault, fontSize: font.body, lineHeight: 22 }}>
            {'No adapter was connected. Check Bluetooth is on and allowed for Fractal Remote, then tap Connect again.'}
          </Text>
        ) : null}
        {!b.on && missed && !b.adapter && !b.trouble && !b.said && onReport ? <ReportThis onPress={() => onReport('No adapter was connected.')} /> : null}
        {b.said ? <Note tone="warn">{b.said}</Note> : null}
        {b.said && onReport ? <ReportThis onPress={() => onReport(b.said)} /> : null}

        {showList ? (
          <View style={{ gap: space.sm }}>
            {/* Said by how many there are: one row under "More than one is here" read as a mistake. */}
            <Hint>{b.looking ? 'Found so far. Tap yours:' : b.devices.length > 1 ? 'More than one is here. Tap yours:' : b.devices.some(isCable) ? 'Tap yours:' : 'Tap your adapter:'}</Hint>
            {b.devices.map((d) => {
              const detail = isCable(d) ? (d.offline ? CABLE_ROW_AWAY : CABLE_ROW) : ios ? (d.offline ? `not connected to this ${deviceNoun()}` : d.fresh ? 'just connected' : '') : signal(d.rssi)
              /* Another unit's adapter says whose it is (lib/bluetooth adapterKeptFor): it is on that unit, and never chosen for this one by itself. */
              const whose = adapterKeptFor(d.id)
              /*
               * An iPhone's row for an adapter not connected to it opens Apple's
               * screen, the only way to connect one: chosen as it was, it could
               * only wait for iOS, under a line saying it was not connected.
               */
              const viaApple = ios && d.offline && !isCable(d) && !shut
              return (
                <Press
                  key={d.id}
                  label={`${d.name || 'An adapter with no name'}${detail ? ` · ${detail}` : ''}${whose ? ` · ${adapterOfUnit(whose)}` : ''}`}
                  sub={viaApple ? APPLE_SCREEN_OPENS : undefined}
                  height={52}
                  disabled={!canStart}
                  onPress={() => (viaApple ? connectInApplesScreen() : choose(d))}
                />
              )
            })}
          </View>
        ) : null}
      </View>

      {/*
        UNDER THE STEPS, ONE BUTTON A PAGE: "Setup Guide > Go to the page that
        shows the full setup guide. How to connect my Bluetooth device > go to
        page that shows (depending on what device they have selected) the
        options of what they need and where they can buy them from on Amazon.
        Troubleshooting ... What Bluetooth can't do button. Report a problem
        button" (Justin, 26 October 2026). Settings draws each page
        (`onOpen`), with ‹ Bluetooth back to this one.
      */}
      <View style={{ gap: space.sm }}>
        <Press label="Setup guide" sub="On the website" height={52} onPress={() => openLink(GUIDE_URL)} />
        {onOpen ? (
          <>
            <Press
              label="How to connect my Bluetooth device"
              sub={b.unit ? `What to buy for the ${unitName(b.unit)}` : 'What to buy, and how it plugs in'}
              height={52}
              onPress={() => onOpen('bt-ways')}
            />
            <Press label="Troubleshooting" sub="If it won’t connect" height={52} onPress={() => onOpen('bt-trouble')} />
            <Press label="What Bluetooth can’t do" height={52} onPress={() => onOpen('bt-limits')} />
          </>
        ) : null}
        {/* The one-tap report, "It works on my unit" among its answers, on every visit. */}
        {onReport ? <Press label={REPORT_BUTTON} sub="Or tell us it works" height={52} onPress={() => onReport(null)} /> : null}
      </View>

      {/*
        THE TWO WAYS, AND THE BUTTON, at the foot of the page rather than
        over the steps: Bluetooth needs no computer, and a computer has less
        lag and more features (BLUETOOTH_WAYS, no ranking), and where to say
        something is not working (REPORT_NOTE).
      */}
      <View style={{ gap: space.sm }}>
        <Hint>{BLUETOOTH_WAYS}</Hint>
        <Hint>{REPORT_NOTE}</Hint>
      </View>
    </View>
  )
}

/* The unit chips of step 1, on this page and on How to connect: the same pick, the same rule (not while it is on). */
function UnitChips({ units, picked, disabled }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {units.map((u) => (
        <Press
          key={u.key}
          label={u.name}
          tone="signal"
          on={u.key === picked}
          disabled={disabled}
          height={44}
          style={{ paddingHorizontal: space.md }}
          onPress={() => setBluetoothUnit(u.key)}
        />
      ))}
    </View>
  )
}

/* Troubleshooting's last step, by adapter or by cable. */
const ANOTHER_UNIT = 'If another unit answered, tap Stop, pick that unit in step 1, and tap Connect again.'

/* The other half of the quiet-unit hint: an adapter that only carries one way. */
const BOTH_WAYS = 'The adapter has to carry MIDI both ways. One with a single plug, in one MIDI jack, only carries one way: use one with two plugs, in the unit’s MIDI In and MIDI Out.'

/**
 * Bluetooth → How to connect my Bluetooth device.
 *
 * Every way to hook up the unit picked, best first (shared/bluetooth-gear
 * waysFor): the WIDI Master, the WIDI Jack, then the WIDI Uhost and a cable
 * on every unit but the FM3, whose one way is the Uhost and the U2MIDI Pro,
 * and, on a device a unit can plug into by cable, that U2MIDI Pro straight
 * in with no adapter (lib/cableWords FM3_CABLE_WAY). Each way is a row
 * that opens on its parts, each with View on Amazon, and its steps; the first is open. A way the app has not run on with this unit
 * says so, and says to feel the adapter in the first minute, straight after
 * the step that powers it.
 */
export function BluetoothWays() {
  const b = useBluetooth()
  const units = offeredUnits()
  const ways = waysFor(b.unit, deviceNoun())
  const [open, setOpen] = useState(0)
  const firmware = firmwareLineFor(b.unit)
  const midi = midiSettingsFor(b.unit, deviceNoun())
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <Heading>Your unit</Heading>
        <UnitChips units={units} picked={b.unit} disabled={b.on} />
        {b.on ? <Hint>To change the unit, tap Stop on the Bluetooth page first.</Hint> : null}
      </View>
      {!b.unit ? <Hint>Pick your unit to see what to buy and how it plugs in.</Hint> : null}
      {/* The FM3's warning, red and in front of everything for it: the U2MIDI Pro, never the C2MIDI Pro or a WIDI Master. */}
      {warningFor(b.unit) ? <Note tone="fault">{warningFor(b.unit)}</Note> : null}
      {firmware ? <Hint>{firmware}</Hint> : null}
      {ways.map((w, i) => (
        <Fold key={w.key} title={`${ways.length > 1 ? `Option ${i + 1} · ` : ''}${w.title}`} sub={w.best ? 'The simplest' : undefined} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)}>
          <Way way={w} unit={b.unit} />
        </Fold>
      ))}
      {/* The FM3's other way, with no adapter: the same U2MIDI Pro straight into this device, wherever a unit can plug in by cable at all (lib/bluetooth cablesHere). Nothing more to buy. */}
      {b.unit === 'fm3' && cablesHere() ? <Hint>{FM3_CABLE_WAY(deviceNoun())}</Hint> : null}
      {midi ? <Hint>{midi}</Hint> : null}
      {b.unit ? <Hint>{ONE_AT_A_TIME}</Hint> : null}
      {b.unit ? <Hint>{SELLERS_LINE}</Hint> : null}
      {/* The View on Amazon buttons carry his Associates tag, so the page says Amazon's sentence (shared/bluetooth-gear AMAZON_DISCLOSURE): once, the last line of the page, not beside the buttons (Justin, 10 November 2026). */}
      {b.unit && ways.some((w) => w.parts.some((key) => PARTS[key]?.amazon)) ? <Hint>{AMAZON_DISCLOSURE}</Hint> : null}
    </View>
  )
}

/* One way to hook it up: whether it has run here, what to buy, the firmware, then the steps with the heat check after the power. */
function Way({ way, unit }) {
  return (
    <View style={{ gap: space.md }}>
      {way.parts.map((key) => {
        const p = PARTS[key]
        const does = typeof p.does === 'function' ? p.does(deviceNoun()) : p.does
        return (
          <View key={key} style={{ gap: space.xs }}>
            <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>{p.name}</Text>
            <Hint>{does}</Hint>
            {/* On Amazon where a link has been checked; the maker's own page where none has. */}
            <Press
              label={p.amazon ? 'View on Amazon' : 'View on the maker’s site'}
              height={44}
              accessibilityLabel={p.amazon ? `View the ${p.name} on Amazon` : `View the ${p.name} on the maker’s site`}
              onPress={() => openLink(p.amazon || p.maker)}
            />
          </View>
        )
      })}
      {way.key === 'uhost' ? <Hint>{POWER_LINE}</Hint> : null}
      {/* The C2MIDI Pro or a WIDI Master bought for another unit is the likeliest thing to end up on an FM3: said where they are bought. */}
      {unit !== 'fm3' && (way.key === 'uhost' || way.key === 'master') ? <Hint>{NOT_FOR_FM3}</Hint> : null}
      <Hint>{way.key === 'uhost' ? FIRST_TIME : FIRST_TIME_ADAPTER}</Hint>
      <Heading>How it plugs in</Heading>
      {way.steps.map((line, i) => (
        <View key={line} style={{ flexDirection: 'row', gap: space.sm }}>
          <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: 22, minWidth: 18 }}>{`${i + 1}.`}</Text>
          <Text style={{ flex: 1, color: color.silk, fontSize: font.body, lineHeight: 22 }}>{line}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * Bluetooth → Troubleshooting: "List all the troubleshooting steps that
 * we've created" (Justin, 26 October 2026). Every fix the page and the guide
 * know, in the order they are worth trying, for the unit picked, and the
 * report button at the foot.
 */
export function BluetoothTrouble({ onReport = null, way = null }) {
  const b = useBluetooth()
  const settings = b.unit ? (hookupFor(b.unit, deviceNoun()) || []).at(-1) : null
  const midi = midiSettingsFor(b.unit, deviceNoun())
  /* An FM3 picked, wherever a unit can plug in by cable at all (lib/bluetooth cablesHere): not by its USB port, but by a USB MIDI cable on its MIDI ports (lib/cableWords fm3CableLine). */
  const fm3 = b.unit === 'fm3' && cablesHere() ? fm3CableLine(deviceNoun()) : null
  /*
   * A UNIT ON A USB CABLE CHOSEN: the cable's own steps, and none about an
   * adapter's lights or Bluetooth, which are not in its way. A USB MIDI cable
   * on the unit's MIDI jacks (lib/bluetooth midiJacks) keeps its plugs (the
   * cable's steps for it say them, and that it carries both ways) and the
   * unit's own MIDI settings, as an adapter's MIDI plugs do.
   */
  const cable = isCable(b.adapter)
  const jacks = cable && midiJacks(b.adapter)
  /* `way`: Troubleshooting asked about the adapter or the cable by name, whatever is kept; left out, the way kept decides. The Forget buttons stay the kept one's. */
  const cableWay = way === 'cable' || (way !== 'adapter' && cable)
  const steps = cableWay
    ? [...cableSteps(deviceNoun(), { jacks }), ...(jacks ? [settings, midi] : []), fm3, ANOTHER_UNIT].filter(Boolean)
    : [
        TROUBLE_LIT,
        `Check Bluetooth is on, and allowed for Fractal Remote in the ${deviceNoun()}’s Settings.`,
        `${PLUGS_CHECK} ${swapLine(b.unit)}`,
        BOTH_WAYS,
        settings,
        midi,
        FIRST_TIME,
        ONE_AT_A_TIME,
        CLOSE_AND_REOPEN,
        ios
          ? `An iPhone or iPad lets an adapter nobody is using go after a few minutes. Tap Reconnect, or Stop and then Connect, and connect it again in Apple’s screen.`
          : `Android needs Nearby devices allowed for Fractal Remote, and on Android 11 and older Location turned on, to find the adapter.`,
        /* Forget in Apple's Bluetooth MIDI screen does nothing for an adapter still connected to the device (7 November 2026): the way that does. */
        ios ? appleListForget(deviceNoun()) : null,
        `Stay within about 30 feet of the adapter, with nothing big in between.`,
        ANOTHER_UNIT,
        fm3
      ].filter(Boolean)
  return (
    <View style={{ gap: space.lg }}>
      {steps.map((line, i) => (
        <View key={line} style={{ flexDirection: 'row', gap: space.sm }}>
          <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: 22, minWidth: 22 }}>{`${i + 1}.`}</Text>
          <Text style={{ flex: 1, color: color.silk, fontSize: font.body, lineHeight: 22 }}>{line}</Text>
        </View>
      ))}
      <View style={{ gap: space.sm }}>
        <OpenSettings />
        {/*
          A different adapter: the old one forgotten here, and Connect on the
          Bluetooth page finds the new one. On or off since 3 November 2026
          (the page's Use a different adapter does the same): with Bluetooth
          on, it goes off for that adapter first, which stops the link trying
          it (lib/bluetooth letGoOfKeptAdapter).
        */}
        {b.adapter && !cable ? (
          <Press
            label="Forget the adapter"
            sub={`${adapterName(b.adapter) || 'The adapter'} from last time. ${b.on ? 'Bluetooth goes off, then tap' : 'Then tap'} Connect to pick another.`}
            height={52}
            onPress={() => letGoOfKeptAdapter()}
          />
        ) : null}
        {b.adapter && !b.on && cable ? (
          <Press label="Forget the USB cable" sub={`${b.adapter.name || 'The unit'} on the USB cable, from last time. Then tap Connect to pick another.`} height={52} onPress={() => forgetAdapter({ byHand: true })} />
        ) : null}
        {/*
          THE ADAPTERS KEPT FOR THE OTHER UNITS (lib/bluetooth: each unit keeps
          its own), each with its Forget, so the app's own list never holds
          one for good. The unit picked keeps its Forget above.
        */}
        {adaptersForOtherUnits().map(({ unit, adapter }) => (
          <Press
            key={unit}
            label={`Forget ${adapterName(adapter) || 'the adapter'}`}
            sub={`${isCable(adapter) ? 'The USB cable' : 'The adapter'} kept for the ${unitName(unit)}`}
            height={52}
            onPress={() => forgetAdapterFor(unit)}
          />
        ))}
        {onReport ? <Press label={REPORT_BUTTON} sub="Still stuck? Send us what happened" height={52} onPress={() => onReport(null)} /> : null}
      </View>
    </View>
  )
}

/** Bluetooth → What Bluetooth can't do: what it does, for the unit picked, and what is different from the computer. */
export function BluetoothLimits() {
  const b = useBluetooth()
  const vp4 = b.unit === 'vp4'
  /* Edit over Bluetooth on the unit picked, for this account on this copy: never on a VP4, which is not one whose Edit is built. */
  const editOpen = editOverBluetooth(b.unit)
  return (
    <View style={{ gap: space.md }}>
      {/* A VP4's own: presets and scenes, and nothing heard back (lib/bleVp4.js). Its words are the same whatever the switch says. */}
      <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 22 }}>
        {vp4 ? VP4_OVER_BLUETOOTH : limitsLine(editOpen)}
      </Text>
      <Heading>What’s different from USB</Heading>
      {[editingLine(editOpen), ...DIFFERENT].map((line) => (
        <Bullet key={line}>{line}</Bullet>
      ))}
      {/* The unit's own: blocks Play does not draw yet on an FM9 or Axe-Fx III (shared/bluetooth-gear missingBlocksLine). */}
      {missingBlocksLine(b.unit) ? <Bullet>{missingBlocksLine(b.unit)}</Bullet> : null}
      <Hint>{BLUETOOTH_WAYS}</Hint>
    </View>
  )
}

function Bullet({ children }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: 22 }}>•</Text>
      <Text style={{ flex: 1, color: color.silk, fontSize: font.body, lineHeight: 22 }}>{children}</Text>
    </View>
  )
}

/**
 * Developer → Bluetooth testing tools: the check, for finding out what a real
 * unit does. THE CHECK IS FOR TESTING, and says so. Moved off the Bluetooth
 * page onto the Developer pages (26 October 2026: "If we don't want users
 * using that, move that to the developer menu that only I see"), which only
 * his account is shown, as it was only his on the page: Apple's 2.2 keeps
 * test benches out of what customers see. Not for a VP4, which is never
 * asked anything (lib/bleVp4.js): nothing to check.
 */
export function BluetoothTools() {
  const b = useBluetooth()
  const steps = checkSteps(b.unit)
  const am4 = b.unit === 'am4'
  const connected = b.on && b.phase === 'connected'
  const ways = b.unit ? methodsFor(b.unit) : null
  /* The check's results, newest last, kept while the page is open. */
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(null)
  const [copied, setCopied] = useState(false)

  const run = async (step) => {
    if (busy) return
    setBusy(step)
    setCopied(false)
    try {
      const out = await runCheck(step)
      setResults((was) => [...was, { ...out, unit: b.unit }])
    } finally {
      setBusy(null)
    }
  }

  const labelOf = (step) =>
    step === 'all' ? 'The check' : [...steps.reads, ...steps.writes].find((s) => s.step === step)?.label || step

  const copyAll = async () => {
    const lines = [`Fractal Remote ${APP_VERSION} · Bluetooth check · ${unitForReport(b.unit) || unitName(b.unit)} · ${Platform.OS}`]
    for (const r of results) {
      lines.push('', `${labelOf(r.step)} (${unitName(r.unit)})${r.ok ? '' : ` — failed: ${r.error}`}`)
      if (r.way) lines.push(`  remembered: ${WAY_NAMES[r.way] || r.way}`)
      for (const row of r.rows) {
        lines.push(`  ${row.asked}`, `    out:  ${row.out || '—'}`, `    back: ${row.back || '—'}`, `    ${row.meaning} (${row.ms} ms)`)
      }
    }
    try {
      await Clipboard.setStringAsync(lines.join('\n'))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (!b.unit) return <Hint>Pick a unit on the Bluetooth page first.</Hint>
  if (b.unit === 'vp4') return <Hint>A VP4 is never asked anything over Bluetooth, so there is nothing to check.</Hint>
  return (
        <View style={{ gap: space.md }}>
          <Heading>Check</Heading>
          <Hint>
            For testing. Each row shows what the phone asked, the bytes it sent and the bytes that came back, what
            that means, and how long it took. It needs the adapter connected.
          </Hint>
          <Press label={busy === 'all' ? 'Checking…' : 'Run the check'} disabled={!connected || !!busy} onPress={() => run('all')} />
          <Hint>{`Only asks, changes nothing: ${steps.reads.map((s) => s.label.toLowerCase()).join(', ')}.`}</Hint>

          <Heading>Write checks</Heading>
          {steps.writes.map((s) => (
            <View key={s.step} style={{ gap: space.xs }}>
              <Hint>{s.does}</Hint>
              {s.warn ? <Note tone="warn">{s.warn}</Note> : null}
              <Press label={busy === s.step ? 'Checking…' : s.label} disabled={!connected || !!busy} onPress={() => run(s.step)} />
            </View>
          ))}

          {results.length ? (
            <View style={{ gap: space.md }}>
              <Heading>Results</Heading>
              {results.map((r, i) => (
                <View key={`${r.step}-${i}`} style={{ gap: space.xs }}>
                  <Text style={{ color: r.ok ? color.silk : color.fault, fontSize: font.body, fontWeight: '700' }}>
                    {`${labelOf(r.step)}${r.ok ? '' : ` — failed: ${r.error}`}`}
                  </Text>
                  {r.way ? (
                    <Text style={{ color: color.ok, fontSize: font.small }}>{`Remembered: ${WAY_NAMES[r.way] || r.way}`}</Text>
                  ) : null}
                  {r.rows.map((row, j) => (
                    <Row key={j} row={row} />
                  ))}
                </View>
              ))}
              <Press label={copied ? 'Copied' : 'Copy all'} onPress={copyAll} />
            </View>
          ) : null}

          {/* The FM3, FM9 and III have two ways for some commands; the AM4 has one way for each. */}
          {!am4 && ways ? (
            <View style={{ gap: space.md }}>
              <Heading>How each command is sent</Heading>
              <Hint>Auto tries the first way, checks, and remembers what worked. The others force one.</Hint>
              {/* bleWire editByAuto: FM3-Edit's scene, channel and tempo go to an FM9 or Axe-Fx III only when forced here. */}
              {b.unit !== 'fm3' ? (
                <Hint>{`On the ${unitName(b.unit)}, Auto sends only the published scene, channel and tempo. FM3-Edit’s way goes only when you pick it here.`}</Hint>
              ) : null}
              {HOW.map((h) => (
                <View key={h.key} style={{ gap: space.xs }}>
                  <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>
                    {h.name}
                    {ways[h.key] === 'auto' && ways.learned[h.key] ? (
                      <Text style={{ color: color.silkDim, fontWeight: '400' }}>{` · found: ${WAY_NAMES[ways.learned[h.key]]}`}</Text>
                    ) : null}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                    {WAYS[h.key].map((w) => (
                      <Press
                        key={w}
                        label={WAY_NAMES[w] || w}
                        tone="live"
                        on={ways[h.key] === w}
                        height={44}
                        style={{ paddingHorizontal: space.md }}
                        onPress={() => setMethods({ [h.key]: w })}
                      />
                    ))}
                  </View>
                </View>
              ))}
              <View style={{ gap: space.xs }}>
                <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>
                  MIDI channel for Program Change
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Press
                    label="−"
                    accessibilityLabel="One lower"
                    height={44}
                    style={{ paddingHorizontal: space.lg }}
                    disabled={ways.pcChannel <= 1}
                    onPress={() => setMethods({ pcChannel: ways.pcChannel - 1 })}
                  />
                  <Text style={{ color: color.silk, fontSize: font.lead, fontFamily: face, minWidth: 32, textAlign: 'center' }}>
                    {ways.pcChannel}
                  </Text>
                  <Press
                    label="+"
                    accessibilityLabel="One higher"
                    height={44}
                    style={{ paddingHorizontal: space.lg }}
                    disabled={ways.pcChannel >= 16}
                    onPress={() => setMethods({ pcChannel: ways.pcChannel + 1 })}
                  />
                </View>
                <Hint>The one set on the unit for receiving MIDI. Only used when presets go by Program Change.</Hint>
              </View>
            </View>
          ) : null}
        </View>
  )
}

/**
 * Developer → App health → Tried: which units Bluetooth has run on, through
 * which ways, and what we know of each try (shared/bluetooth-gear TESTED,
 * TRIED_WAYS, TRIED_NOTES). "We just need to keep track of it ourselves in
 * the developer menu so that we can confirm it or if someone leaves us a
 * note saying it doesn't work then we can investigate" (Justin, 31 October
 * 2026). Ours alone: nothing a customer reads says tried or untried.
 */
export function BluetoothTried() {
  return (
    <View style={{ gap: space.md }}>
      <Hint>Updated in the code (shared/bluetooth-gear.mjs) when a unit or an adapter is confirmed.</Hint>
      {BLE_UNITS.map((u) => {
        const ways = waysFor(u.key).filter((w) => w.tried).map((w) => w.title)
        const tried = !untried(u.key)
        return (
          <View key={u.key} style={{ gap: 2, padding: space.sm, borderRadius: classic() ? radius.sm : radius.md, backgroundColor: color.glassFill, boxShadow: color.glassFlat }}>
            <Text style={{ color: tried ? color.ok : color.silkDim, fontSize: font.body, fontWeight: '700' }}>
              {`${u.name} · ${tried ? 'Tried' : 'Not tried yet'}`}
            </Text>
            {ways.length ? <Hint>{`Through: ${ways.join(', ')}`}</Hint> : null}
            {TRIED_NOTES[u.key] ? <Hint>{TRIED_NOTES[u.key]}</Hint> : null}
          </View>
        )
      })}
    </View>
  )
}

/*
 * Report this, under a line that says something is wrong: small, so it never
 * reads as the page's main button, and 44 high, the least a thumb wants.
 */
function ReportThis({ onPress }) {
  return <Press label="Report this" height={44} style={{ alignSelf: 'flex-start', paddingHorizontal: space.lg }} onPress={onPress} />
}

/* An address outside the app: the browser opens it, and a phone that cannot is left where it was. */
const openLink = (url) => Linking.openURL(url).catch(() => {})

/*
 * Fractal Remote's own page in the phone's settings, which is all
 * openSettings opens: on an iPhone the page with its Bluetooth switch on it,
 * on Android the app's page, where Permissions is. Only ever drawn under the
 * line that says what to change there.
 */
function OpenSettings() {
  return <Press label="Open Settings" height={44} onPress={() => Linking.openSettings().catch(() => {})} />
}

/*
 * A row that opens what is under it, and closes it again: its name, and
 * under the name what it is (or what a tap does). A Press like every other
 * button here, so it is in the tap log and has the haptic.
 */
function Fold({ title, sub, open, onToggle, children }) {
  return (
    <View style={{ gap: space.md }}>
      <Press label={title} sub={sub ? `${sub} · ${open ? 'tap to hide' : 'tap to show'}` : open ? 'Tap to hide' : 'Tap to show'} height={52} onPress={onToggle} />
      {open ? <View style={{ gap: space.md, paddingHorizontal: space.xs, paddingBottom: space.sm }}>{children}</View> : null}
    </View>
  )
}

/* One question the check asked, with its bytes: a flat panel of glass, its rim a ring inside it (lib/glass), so nothing moves. */
function Row({ row }) {
  return (
    <View style={{ gap: 2, padding: space.sm, borderRadius: classic() ? radius.sm : radius.md, backgroundColor: color.glassFill, boxShadow: color.glassFlat }}>
      <Text style={{ color: color.silk, fontSize: font.small, fontWeight: '700' }}>{row.asked}</Text>
      <Text selectable style={{ color: color.silkDim, fontSize: font.micro, fontFamily: face }}>
        {`out  ${row.out || '—'}`}
      </Text>
      <Text selectable style={{ color: color.silkDim, fontSize: font.micro, fontFamily: face }}>
        {`back ${row.back || '—'}`}
      </Text>
      <Text style={{ color: color.silk, fontSize: font.small }}>{`${row.meaning} · ${row.ms} ms`}</Text>
    </View>
  )
}

function Heading({ children }) {
  return (
    <Text
      accessibilityRole="header"
      style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }}
    >
      {children}
    </Text>
  )
}

function Hint({ children }) {
  return <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: 19 }}>{children}</Text>
}
