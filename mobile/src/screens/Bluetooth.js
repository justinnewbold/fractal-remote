import { Fragment, useEffect, useRef, useState } from 'react'
import { Linking, Platform, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { color, font, mono, radius, space } from '../lib/theme'
import { APP_VERSION } from '../lib/version'
import { WAYS } from '../lib/bleWire'
import {
  ALLOW_WORDS,
  APPLE_SCREEN_OPENS,
  RESTRICTED_WORDS,
  adapterAway,
  adapterDevices,
  checkSteps,
  chooseAdapter,
  findAdapters,
  forgetAdapter,
  lookForAdapterAgain,
  methodsFor,
  offeredUnits,
  pairScreenShut,
  runCheck,
  setBluetooth,
  setBluetoothUnit,
  setMethods,
  unitName,
  useBluetooth,
  useBluetoothAdmin
} from '../lib/bluetooth'
import {
  BLUETOOTH_WAYS,
  CLOSE_AND_REOPEN,
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
  TROUBLE_LIT,
  VP4_CANT_HEAR,
  VP4_CONNECTED,
  VP4_OVER_BLUETOOTH,
  WAY_UNTRIED,
  betaNote,
  firmwareLineFor,
  hookupFor,
  midiSettingsFor,
  missingBlocksLine,
  notAnsweringLine,
  untried,
  untriedAboutLine,
  untriedConnectedLine,
  untriedLine,
  untriedSubFor,
  unitForReport,
  feelLine,
  warningFor,
  swapLine,
  waysFor,
  wrongUnitLine
} from '../lib/bluetooth-gear'
import { deviceNoun } from '../lib/device-word'
import { probeNow } from '../lib/link'
import { useRig } from '../lib/rig'
import { mayDriveBluetooth } from '../lib/unlock-rule'
import Note from '../components/Note'
import Press from '../components/Press'

/**
 * Settings → Bluetooth (beta).
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
 * A BETA, and it says so: in the head (Bluetooth (beta)), and in the note
 * under the rows, always drawn and never folded. "Let's just say that
 * Bluetooth is beta though in the app and give like a disclaimer saying that
 * Bluetooth might not function correctly." It was a public beta for one day;
 * since 11 October 2026 it is Justin's account's on every copy, and a
 * customer's only on a copy whose built-in store version opens it (lib/
 * ble-rule.js, which no copy today does): Settings draws this page for
 * nobody else (useBluetoothAllowed, lib/bluetooth.js). It has run one AM4,
 * from an iPhone and from an Android phone.
 *
 * TWO WAYS TO CONNECT, AND THE COMPUTER IS THE BEST. "Make it clear that
 * there's multiple ways to connect the device, but also make it clear that
 * the computer is the preferred method and that Bluetooth will have more lag
 * and not have as many features." (25 October 2026.) Said first, in one
 * line over the steps (BLUETOOTH_WAYS, the same words as the Settings row,
 * the waiting screen and the purchase page), before anybody taps Connect.
 *
 * EVERY UNIT, AND WHICH HAVE BEEN TRIED. Step 1 offers what lib/bluetooth
 * says this account may pick (offeredUnits): all five on a copy that opens
 * Bluetooth (beta) to customers, as on his account. Every unit it has not
 * run on says so under its name and wherever else it is read (shared/
 * bluetooth-gear untried), with the report button by it: "as long as
 * there's warnings for user that it's in beta and they're free to test it
 * and submit feedback, but it might not work properly" (Justin, 25 October
 * 2026). And everybody, before any pick and whatever is picked, is told the
 * cable is never for an FM3 (NOT_FOR_FM3).
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
 * customer with the full version): a big Report a Bluetooth problem straight
 * under the beta note, on every visit, and a small Report this beside each
 * line that says something is wrong, which sends that line with the report.
 * Not beside the line that says Bluetooth is not allowed, which has Open
 * Settings, the fix, under it, and not beside "Unlock the app", which is not
 * a problem with Bluetooth. Both open the report screen (screens/Report,
 * `onReport`, App's through Settings) with what is wrong said on it, which
 * comes back here.
 *
 * The beta note is the iPhone's or Android's own (betaNote, from
 * shared/bluetooth-gear.mjs): only Android's names an Android phone, because
 * Apple's 2.3.10 keeps other phones' names out of an iPhone app, and this is
 * the page the review notes will send Apple's reviewer to on the day
 * Bluetooth goes to customers. (The 1.87.11 notes Apple approved say only
 * the developer's account sees it.)
 *
 * THE DEVICE IN HAND, BY ITS NAME (lib/device-word deviceNoun): an iPad or a
 * tablet reads "this iPad", "the tablet's settings", never "this phone".
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
/* The iPhone's copy names the iPhone it was tried from; Android's names an Android phone as well. */
const BETA_NOTE = betaNote(Platform.OS)

/* What a player loses by leaving the cable at home, in the order it is noticed. */
const DIFFERENT = [
  'No editing or saving over Bluetooth.',
  'Slower to load the preset list.',
  'Footswitch changes may take a moment to show.',
  'About 30 feet of range.',
  'The adapter connects to one thing at a time.',
  'On the AM4, scene names take a moment the first time a preset is seen.',
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
  /* Whatever the switch says: finding the adapter before turning this on is the usual order, and a search that could not start has to say why. */
  if (b.trouble === 'bluetooth-off') return { line: `Turn on Bluetooth in the ${deviceNoun()}’s settings`, tone: 'fault' }
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
      return {
        line: wrongUnitLine({ answered: b.answeredAs, picked: name, pickable: units.some((u) => u.name === b.answeredAs) }),
        tone: 'fault'
      }
    }
    /* A VP4 never answers over Bluetooth (lib/bleVp4.js): connected is the adapter, and the phone sending. */
    if (b.unit === 'vp4') return { line: VP4_CONNECTED, tone: 'ok' }
    if (unitState === 'present') return { line: `Connected · ${name} answering`, tone: 'ok' }
    /* The usual reasons, by unit (shared/bluetooth-gear notAnsweringLine): the Axe-Fx III has no MIDI Thru setting, only a THRU jack the white plug must stay out of. */
    if (unitState === 'missing' || unitState === 'silent') return { line: notAnsweringLine(b.unit), tone: 'fault' }
    return { line: `Connected · asking the ${name}…`, tone: 'dim' }
  }
  return { line: `Connecting to ${b.adapter?.name || 'the adapter'}…`, tone: 'dim' }
}

/* Blue for the unit answering over Bluetooth, as the bar is; green stays the unit answering through a computer. */
const TONES = { ok: () => color.ble, fault: () => color.fault, dim: () => color.silkDim }

export default function BluetoothPage({ purchase, admin = false, onReport = null, onOpen = null, onConnected = null }) {
  const b = useBluetooth()
  const unitState = useRig((s) => s.unit)
  const said = status(b, unitState)
  /*
   * REPORT THIS, beside what is wrong: a fault line, except the one with
   * Open Settings under it and the one about unlocking. When the adapter is
   * connected and the unit says nothing, it goes under the hint that says
   * why, rather than between the line and its hint.
   */
  const quiet = b.on && b.phase === 'connected' && !b.answeredAs && (unitState === 'missing' || unitState === 'silent')
  const reportable = said.tone === 'fault' && b.trouble !== 'permission' && b.phase !== 'locked' && !!onReport
  const connected = b.on && b.phase === 'connected'
  /* The units step 1 offers this account (lib/bluetooth offeredUnits). */
  const units = offeredUnits()
  const vp4 = b.unit === 'vp4'
  /* A unit nobody has tried it on yet (the FM9, the Axe-Fx III, the VP4) says so under "Connected" (shared/bluetooth-gear untriedConnectedLine). */
  const untriedHere = said.tone === 'ok' && !b.answeredAs ? untriedConnectedLine(b.unit) : null
  /* Where it stands, in one big line: drawn while it is on, or when something is wrong. Off and fine, the steps are the first thing on the page. */
  const sayIt = b.on || !!b.trouble || said.tone === 'fault'

  /*
   * CONNECT. With an adapter from last time, that is all it does: Bluetooth
   * on. Without one it goes and finds it, and Bluetooth comes on the moment
   * one is chosen — by the phone when only one could be meant, or by a tap
   * in the list when there is a real choice. `wanted` is that promise, kept
   * until an adapter arrives.
   */
  const [wanted, setWanted] = useState(false)
  /* Apple's screen closed with no adapter connected in it. */
  const [missed, setMissed] = useState(false)
  /* The full version as Bluetooth reads it: the purchase itself for a customer, never "the store cannot be reached" (unlock-rule mayDriveBluetooth). */
  const his = useBluetoothAdmin()
  const paid = mayDriveBluetooth(purchase, his)
  useEffect(() => {
    if (!wanted || !b.adapter || !b.unit || b.on) return
    setWanted(false)
    if (paid) setBluetooth(true)
  }, [wanted, b.adapter?.id, b.unit, b.on, paid])

  const canStart = !!b.unit && paid
  /* Apple's screen kept shut (iOS 27, before the build with Apple's fix): no hint sends anybody to it. */
  const shut = pairScreenShut()
  const find = async () => {
    setMissed(false)
    setWanted(true)
    const pick = await findAdapters()
    if (ios && !pick && !adapterDevices().some((d) => !d.offline)) setMissed(true)
  }
  /* Another adapter: forget this one, then the same as the first time. */
  const another = () => {
    if (!canStart) return
    forgetAdapter()
    find()
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
   * search, on Android) when it is not. A different adapter is Troubleshooting's.
   */
  const start = () => {
    if (!canStart) return
    arm()
    if (b.adapter && ios && offlineHere(b.adapter)) return another()
    if (b.adapter) setBluetooth(true)
    else find()
  }
  /* A row tapped in the list: that adapter, and on. */
  const choose = (d) => {
    arm()
    chooseAdapter(d)
    setWanted(true)
  }
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
            <Text accessibilityLiveRegion="polite" style={{ color: TONES[said.tone](), fontSize: font.lead, fontWeight: '700', lineHeight: 26 }}>
              {said.line}
            </Text>
            {b.trouble === 'permission' ? <OpenSettings /> : null}
            {reportable && !quiet ? <ReportThis onPress={() => onReport(said.line)} /> : null}
            {untriedHere ? <Hint>{untriedHere}</Hint> : null}
            {vp4 && connected && !b.answeredAs ? <Hint>{VP4_CANT_HEAR}</Hint> : null}
          </View>
        ) : null}
        {/*
          FEEL IT, ON A UNIT NOBODY HERE HAS RUN IT ON, while it is on: the
          one moment it matters, and never in a fold (the ways page says it
          again, straight after each way's power step).
        */}
        {b.on && untried(b.unit) ? <Note tone="warn">{feelLine('adapter')}</Note> : null}

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
            {quiet ? <Hint>{PLUGS_CHECK}</Hint> : null}
            {/*
              STILL NOTHING AFTER THE ADAPTER WAS UNPLUGGED AND PLUGGED BACK
              IN: the way out that worked for him was closing the app
              completely (shared/bluetooth-gear CLOSE_AND_REOPEN).
            */}
            {b.phase === 'connecting' || quiet ? <Hint>{CLOSE_AND_REOPEN}</Hint> : null}
            {reportable && quiet ? <ReportThis onPress={() => onReport(said.line)} /> : null}
            {b.phase === 'connecting' ? (
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
            {/* The unit chips are not drawn while it is on: which one was picked, and how to change it. */}
            {b.unit ? <Hint>{`Unit: ${unitName(b.unit)}. Tap Stop to change it.`}</Hint> : null}
            <Press label="Stop using Bluetooth" sub="Goes back to the computer" height={52} onPress={() => setBluetooth(false)} />
          </View>
        ) : (
          <View style={{ gap: space.lg }}>
            {/*
              STEP 1. Only drawn while it is off: a tap here while connected
              would send the new unit's messages straight away to whatever is
              on the adapter, and the AM4 has frozen on messages it did not
              expect. "Not tried yet" under every unit it has not run on
              (shared/bluetooth-gear untriedSubFor). THE FM3'S WARNING, ONLY
              WHEN IT IS PICKED: "if they select FM3, why we wanna give the
              warning" (Justin, 26 October 2026), red, straight under the
              units and never folded (FM3_NEVER).
            */}
            <View style={{ gap: space.sm }}>
              <Heading>1 · Pick your unit</Heading>
              <UnitChips units={units} picked={b.unit} disabled={b.on} />
              {b.unit === 'fm3' ? <Note tone="fault">{FM3_NEVER}</Note> : null}
            </View>

            {/* STEP 2. One button. */}
            <View style={{ gap: space.sm }}>
              <Heading>2 · Connect</Heading>
              <Press label={b.looking ? 'Looking…' : 'Connect'} tone="live" disabled={!canStart || b.looking} onPress={start} />
              {/* Not on iOS 27 once Connect has been tapped: the note under it then says the same, and says it louder. */}
              {shut && b.said ? null : (
                <Hint>
                  {!b.unit
                    ? 'Pick your unit first.'
                    : b.adapter
                      ? `Uses ${b.adapter.name || 'the adapter'}, from last time.`
                      : shut
                        ? `On iOS 27, Apple’s Bluetooth screen stays closed until the next build of the app. Connect uses an adapter that is already connected to this ${deviceNoun()}.`
                        : ios
                          ? 'In Apple’s screen, tap your adapter, wait until it says Connected, then tap Done.'
                          : `The ${deviceNoun()} looks for the adapter for ten seconds, then connects to it. If Android asks to pair, accept.`}
                </Hint>
              )}
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
            <Hint>{b.looking ? 'Found so far. Tap yours:' : b.devices.length > 1 ? 'More than one is here. Tap yours:' : 'Tap your adapter:'}</Hint>
            {b.devices.map((d) => {
              const detail = ios ? (d.offline ? `not connected to this ${deviceNoun()}` : d.fresh ? 'just connected' : '') : signal(d.rssi)
              return (
                <Press
                  key={d.id}
                  label={`${d.name || 'An adapter with no name'}${detail ? ` · ${detail}` : ''}`}
                  height={52}
                  disabled={!canStart}
                  onPress={() => choose(d)}
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
        THE TWO WAYS, AND WHERE IT HAS BEEN TRIED, at the foot of the page
        rather than over the steps: the computer is the best one, and this
        one is slower and does less (BLUETOOTH_WAYS, the one sentence every
        way onto this page says), and the units it has run on (betaNote).
      */}
      <View style={{ gap: space.sm }}>
        <Hint>{BLUETOOTH_WAYS}</Hint>
        <Hint>{BETA_NOTE}</Hint>
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
          sub={untriedSubFor(u.key)}
          tone="signal"
          on={u.key === picked}
          disabled={disabled}
          height={units.some((x) => untried(x.key)) ? 52 : 44}
          style={{ paddingHorizontal: space.md }}
          onPress={() => setBluetoothUnit(u.key)}
        />
      ))}
    </View>
  )
}

/* The other half of the quiet-unit hint: an adapter that only carries one way. */
const BOTH_WAYS = 'The adapter has to carry MIDI both ways. One with a single plug, in one MIDI jack, only carries one way: use one with two plugs, in the unit’s MIDI In and MIDI Out.'

/**
 * Bluetooth → How to connect my Bluetooth device.
 *
 * Every way to hook up the unit picked, best first (shared/bluetooth-gear
 * waysFor): the WIDI Master, the WIDI Jack, then the WIDI Uhost and a cable
 * on every unit but the FM3, whose one way is the Uhost and the U2MIDI Pro.
 * Each way is a row that opens on its parts, each with View on Amazon, and
 * its steps; the first is open. A way the app has not run on with this unit
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
  const untriedUnit = untriedLine(b.unit)
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
        <Fold key={w.key} title={`${ways.length > 1 ? `Option ${i + 1} · ` : ''}${w.title}`} sub={w.best ? 'The simplest' : w.tried ? 'Tried and working' : undefined} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)}>
          <Way way={w} unit={b.unit} />
        </Fold>
      ))}
      {midi ? <Hint>{midi}</Hint> : null}
      {b.unit ? <Hint>{ONE_AT_A_TIME}</Hint> : null}
      {untriedUnit ? <Note tone="warn">{untriedUnit}</Note> : null}
      {b.unit ? <Hint>{SELLERS_LINE}</Hint> : null}
    </View>
  )
}

/* One way to hook it up: whether it has run here, what to buy, the firmware, then the steps with the heat check after the power. */
function Way({ way, unit }) {
  return (
    <View style={{ gap: space.md }}>
      {way.tried ? null : <Note tone="warn">{WAY_UNTRIED}</Note>}
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
        <Fragment key={line}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: 22, minWidth: 18 }}>{`${i + 1}.`}</Text>
            <Text style={{ flex: 1, color: color.silk, fontSize: font.body, lineHeight: 22 }}>{line}</Text>
          </View>
          {i === way.powerAt && way.feelLine ? <Note tone="warn">{way.feelLine}</Note> : null}
        </Fragment>
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
export function BluetoothTrouble({ onReport = null }) {
  const b = useBluetooth()
  const settings = b.unit ? (hookupFor(b.unit, deviceNoun()) || []).at(-1) : null
  const midi = midiSettingsFor(b.unit, deviceNoun())
  const steps = [
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
    `Stay within about 30 feet of the adapter, with nothing big in between.`,
    `If another unit answered, tap Stop, pick that unit in step 1, and tap Connect again.`
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
        {/* A different adapter: the old one forgotten here, and Connect on the Bluetooth page finds the new one. */}
        {b.adapter && !b.on ? (
          <Press label="Forget the adapter" sub={`${b.adapter.name || 'The adapter'} from last time. Then tap Connect to pick another.`} height={52} onPress={() => forgetAdapter()} />
        ) : null}
        {onReport ? <Press label={REPORT_BUTTON} sub="Still stuck? Send us what happened" height={52} onPress={() => onReport(null)} /> : null}
      </View>
    </View>
  )
}

/** Bluetooth → What Bluetooth can't do: what it does, for the unit picked, and what is different from the computer. */
export function BluetoothLimits() {
  const b = useBluetooth()
  const vp4 = b.unit === 'vp4'
  return (
    <View style={{ gap: space.md }}>
      {untriedAboutLine(b.unit) ? <Note tone="warn">{untriedAboutLine(b.unit)}</Note> : null}
      {/* A VP4's own: presets and scenes, and nothing heard back (lib/bleVp4.js). */}
      <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 22 }}>
        {vp4
          ? VP4_OVER_BLUETOOTH
          : 'Presets, scenes, names, effects on and off, channels, tempo and the tuner, with no computer. No editing or saving.'}
      </Text>
      <Heading>What’s different from USB</Heading>
      {DIFFERENT.map((line) => (
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

/* One question the check asked, with its bytes. */
function Row({ row }) {
  return (
    <View style={{ gap: 2, padding: space.sm, borderRadius: radius.sm, backgroundColor: color.panel }}>
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
