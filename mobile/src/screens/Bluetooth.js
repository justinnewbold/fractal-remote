import { useEffect, useState } from 'react'
import { Linking, Platform, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { color, font, mono, radius, space } from '../lib/theme'
import { APP_VERSION } from '../lib/version'
import { BLE_UNITS, WAYS } from '../lib/bleWire'
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
  AM4_ONLY,
  BLUETOOTH_WAYS,
  FIRST_TIME,
  GEAR_IN_SHORT,
  GEAR_IN_SHORT_AM4,
  GUIDE_URL,
  NOT_FOR_FM3,
  ONE_AT_A_TIME,
  PLUGS_CHECK,
  POWER_LINE,
  SELLERS_LINE,
  betaNote,
  hookupFor,
  partsFor,
  untriedLine,
  warningFor
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
 * THE AM4 ONLY, FOR A CUSTOMER. Step 1 offers what lib/bluetooth says this
 * account may pick (offeredUnits): the AM4 alone for a customer, all four for
 * his account. And everybody, before any pick and whatever is picked, is
 * told it is not for an FM3, whose owners would otherwise never see why.
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
     * The wrong unit picked: the phone has stopped sending to it, and this is
     * the way out. Only sent to a unit this account can pick in step 1 (it is
     * always the AM4: bleWire's onForeign names nothing else); never to one a
     * customer is not offered.
     */
    if (b.answeredAs) {
      const pickable = offeredUnits().some((u) => u.name === b.answeredAs)
      return {
        line: pickable
          ? `An ${b.answeredAs} answered, not the ${name}. Tap Stop, pick ${b.answeredAs} in step 1, then tap Connect.`
          : `An ${b.answeredAs} answered, not the ${name}. ${AM4_ONLY} Tap Stop, and use the computer for the ${b.answeredAs}.`,
        tone: 'fault'
      }
    }
    if (unitState === 'present') return { line: `Connected · ${name} answering`, tone: 'ok' }
    if (unitState === 'missing' || unitState === 'silent') {
      return {
        line: `Adapter connected, but the ${name} isn’t answering. Check both MIDI plugs, and that MIDI Thru is off.`,
        tone: 'fault'
      }
    }
    return { line: `Connected · asking the ${name}…`, tone: 'dim' }
  }
  return { line: `Connecting to ${b.adapter?.name || 'the adapter'}…`, tone: 'dim' }
}

/* Blue for the unit answering over Bluetooth, as the bar is; green stays the unit answering through a computer. */
const TONES = { ok: () => color.ble, fault: () => color.fault, dim: () => color.silkDim }

export default function BluetoothPage({ purchase, admin = false }) {
  const b = useBluetooth()
  const unitState = useRig((s) => s.unit)
  const said = status(b, unitState)
  const steps = checkSteps(b.unit)
  const am4 = b.unit === 'am4'
  const connected = b.on && b.phase === 'connected'
  const ways = b.unit ? methodsFor(b.unit) : null
  /* The units step 1 offers this account (lib/bluetooth offeredUnits), and whether that is the AM4 alone: a customer's page. */
  const units = offeredUnits()
  const am4Only = units.length < BLE_UNITS.length

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
    const lines = [`Fractal Remote ${APP_VERSION} · Bluetooth (beta) check · ${unitName(b.unit)} · ${Platform.OS}`]
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
  const start = () => {
    if (!canStart) return
    if (b.adapter && ios && offlineHere(b.adapter)) return another()
    if (b.adapter) setBluetooth(true)
    else find()
  }
  /* A row tapped in the list: that adapter, and on. */
  const choose = (d) => {
    chooseAdapter(d)
    setWanted(true)
  }
  /*
   * RECONNECT, ON AN IPHONE WHOSE ADAPTER HAS GONE. An iPhone lets a
   * Bluetooth link nobody is using go after a few minutes (a phone locked
   * between songs), and the link cannot bring it back by itself: only
   * Apple's screen can (lib/bluetooth adapterAway). So while it is on and
   * away, one button opens that screen straight away (lookForAdapterAgain),
   * where it was Stop, Connect and the screen. Not while Apple's screen is
   * kept shut. The hint over it says to check the adapter first (a power
   * bank that switched itself off leaves Apple's screen empty on every
   * tap), and the line under it what to do in Apple's screen
   * (APPLE_SCREEN_OPENS), the same words as the other two buttons that open
   * it.
   */
  const away = b.on && b.phase === 'connecting' && ios && !shut && adapterAway()
  const reconnect = () => lookForAdapterAgain(probeNow)

  /* The list is only for a real choice: no adapter chosen yet, and some to choose from. */
  const showList = !b.on && !b.adapter && b.devices.length > 0
  const [tools, setTools] = useState(false)
  /* How to plug it in: open for the first setting up, folded once an adapter has been used here. The other two wait to be tapped. */
  const [plug, setPlug] = useState(!b.adapter)
  const [buy, setBuy] = useState(false)
  const [about, setAbout] = useState(false)

  return (
    <View style={{ gap: space.xl }}>
      {/*
        THE FIRST SCREEN: where it stands, which unit, and the one button.
        Everything a person does on this page is in this block, so nobody
        scrolls to find Connect.
      */}
      <View style={{ gap: space.lg }}>
        {/*
          WHERE IT STANDS, in one big line, on or off: Not connected,
          Connected, or what is wrong. NOT ALLOWED, AND THE WAY TO ALLOW IT,
          one tap away directly under it, the one place Open Settings is
          drawn. Not for 'restricted', whose line says the block is somewhere
          the app's own page cannot reach.
        */}
        <View style={{ gap: space.sm }}>
          <Text accessibilityLiveRegion="polite" style={{ color: TONES[said.tone](), fontSize: font.lead, fontWeight: '700', lineHeight: 26 }}>
            {said.line}
          </Text>
          {b.trouble === 'permission' ? <OpenSettings /> : null}
        </View>

        {b.on ? (
          <View style={{ gap: space.sm }}>
            {/*
              The usual reasons a connected adapter hears nothing back: the
              two plugs swapped, or an adapter that only carries one way. And
              for a customer, first, that it is the AM4 alone: an FM9 owner
              who picked the AM4 anyway hears that, not only the plugs.
            */}
            {b.phase === 'connected' && !b.answeredAs && (unitState === 'missing' || unitState === 'silent') ? (
              <Hint>
                {`${am4Only ? `${AM4_ONLY} ` : ''}${PLUGS_CHECK} The adapter has to carry MIDI both ways. One with a single plug, in one MIDI jack, only carries one way: use one with two plugs, in the unit’s MIDI In and MIDI Out.`}
              </Hint>
            ) : null}
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
            {/* The unit chips are not drawn while it is on, and Connecting… or Disconnected names no unit: which one was picked, and how to change it. */}
            {b.unit ? <Hint>{`Unit: ${unitName(b.unit)}. To change it, tap Stop first.`}</Hint> : null}
            <Press label="Stop using Bluetooth" onPress={() => setBluetooth(false)} />
            <Hint>{`While Bluetooth is on, the ${deviceNoun()} does not use the computer at all. Stop goes back to the computer.`}</Hint>
          </View>
        ) : (
          <View style={{ gap: space.lg }}>
            {/*
              THE TWO WAYS, BEFORE ANYTHING IS TAPPED: the computer is the
              best, and this one is slower and does less (BLUETOOTH_WAYS,
              shared/bluetooth-gear.mjs, the one sentence every way onto this
              page says).
            */}
            <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 22 }}>{BLUETOOTH_WAYS}</Text>
            {/*
              STEP 1. Only drawn while it is off: a tap here while connected
              would send the new unit's messages straight away to whatever is
              on the adapter, and the AM4 has frozen on messages it did not
              expect. While it is on, a line over Stop names the unit, and
              says Stop comes first.

              The units this account is offered (`units`): the AM4 alone for a
              customer. Under them, to everybody and whatever is picked, that
              it is not for an FM3.
            */}
            <View style={{ gap: space.sm }}>
              <Heading>1 · Pick your unit</Heading>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {units.map((u) => (
                  <Press
                    key={u.key}
                    label={u.name}
                    tone="signal"
                    on={u.key === b.unit}
                    disabled={b.on}
                    height={44}
                    style={{ paddingHorizontal: space.md }}
                    onPress={() => setBluetoothUnit(u.key)}
                  />
                ))}
              </View>
              <Hint>{am4Only ? `${AM4_ONLY} ${NOT_FOR_FM3}` : NOT_FOR_FM3}</Hint>
            </View>

            {/* STEP 2. One button. */}
            <View style={{ gap: space.sm }}>
              <Heading>2 · Connect</Heading>
              <Press
                label={b.looking ? 'Looking…' : b.adapter ? `Connect to ${b.adapter.name || 'the adapter'}` : 'Connect'}
                tone="live"
                disabled={!canStart || b.looking}
                onPress={start}
              />
              {/* Not on iOS 27 once Connect has been tapped: the note under it then says the same, and says it louder. */}
              {shut && b.said ? null : (
                <Hint>
                  {!b.unit
                    ? 'Pick your unit first, just above.'
                    : b.adapter
                      ? 'Uses the adapter from last time.'
                      : shut
                        ? `On iOS 27, Apple’s Bluetooth screen stays closed until the next build of the app. Connect uses an adapter that is already connected to this ${deviceNoun()}.`
                        : ios
                          ? `Apple’s Bluetooth screen opens. Tap your adapter, wait until it says Connected, then tap Done. The ${deviceNoun()} does the rest.`
                          : `The ${deviceNoun()} looks for the adapter for ten seconds, then connects to it. If Android asks to pair with it, accept.`}
                </Hint>
              )}
              {b.adapter ? <Press label="Use a different adapter" height={44} disabled={!canStart || b.looking} onPress={another} /> : null}
            </View>
          </View>
        )}

        {/* Not under a trouble line or a note, which already say what is wrong: on iOS 27 the note says Apple's screen stayed shut, and this line would send him to it. */}
        {!b.on && missed && !b.adapter && !b.trouble && !b.said ? (
          <Text style={{ color: color.fault, fontSize: font.body, lineHeight: 22 }}>
            {`No adapter was connected. Check Bluetooth is on, and allowed for Fractal Remote in the ${deviceNoun()}’s Settings. Then tap Connect again, and in Apple’s screen tap your adapter and wait for Connected before Done.`}
          </Text>
        ) : null}
        {b.said ? <Note tone="warn">{b.said}</Note> : null}

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
        WHAT IS READ ONCE, under the button rather than over it, each in a
        row that opens when tapped. "We need to provide as much instructions
        as possible on how to connect it and hook it up… Maybe we could add
        these with the Amazon links on how to buy them?" All of it is still
        here, for the unit picked in step 1, and the rest, from the lights on
        the Uhost to what to do when nothing answers, is on the website's
        guide, one tap away.
      */}
      <View style={{ gap: space.sm }}>
        <Fold title="How to plug it in" open={plug} onToggle={() => setPlug(!plug)}>
          <PlugIn unit={b.unit} />
        </Fold>
        <Fold title="What to buy" open={buy} onToggle={() => setBuy(!buy)}>
          <Buy unit={b.unit} am4Only={am4Only} />
        </Fold>
        <Fold title="What it can and can’t do" open={about} onToggle={() => setAbout(!about)}>
          <Text style={{ color: color.silk, fontSize: font.body, lineHeight: 22 }}>
            {`The ${deviceNoun()} talks straight to your unit through a Bluetooth MIDI adapter plugged into its MIDI In and MIDI Out. Presets, scenes, names, effects on and off, channels, tempo and the tuner. No editing or saving, and the computer isn’t used.`}
          </Text>
          <Heading>What’s different from USB</Heading>
          {DIFFERENT.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: space.sm }}>
              <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: 22 }}>•</Text>
              <Text style={{ flex: 1, color: color.silk, fontSize: font.body, lineHeight: 22 }}>{line}</Text>
            </View>
          ))}
        </Fold>
        <Press label="Full setup guide" height={44} onPress={() => openLink(GUIDE_URL)} />
      </View>

      {/* The beta, on every visit and never folded: what it is, where it has been tried, and the way back. */}
      <Note tone="warn">{BETA_NOTE}</Note>

      {/* For finding out what a real unit does: Justin's account only, and out of the way until asked for. */}
      {admin && b.unit ? (
        <Press label={tools ? 'Hide testing tools' : 'Testing tools'} height={44} onPress={() => setTools(!tools)} />
      ) : null}
      {admin && b.unit && tools ? (
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
      ) : null}
    </View>
  )
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
 * How it plugs together, for one unit: the Uhost's first-time update, then
 * the steps, in the gear file's own words, and then that the computer app
 * is quit or the unit's USB unplugged while it is used (ONE_AT_A_TIME). A
 * unit nobody has tried it on yet says so under the steps rather than being
 * promised to work. The FM3 gets its warning instead: what happened when the
 * parts went straight in, and what owners report.
 */
function PlugIn({ unit }) {
  if (!unit) return <Hint>Pick your unit above to see how it plugs in.</Hint>
  const warning = warningFor(unit)
  if (warning) return <Note tone="fault">{warning}</Note>
  const steps = hookupFor(unit, deviceNoun()) || []
  const untried = untriedLine(unit)
  return (
    <View style={{ gap: space.sm }}>
      {/* Once, before any of the plugging in: the Uhost's firmware, which the steps take for granted. */}
      <Hint>{FIRST_TIME}</Hint>
      {steps.map((line, i) => (
        <View key={line} style={{ flexDirection: 'row', gap: space.sm }}>
          <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: 22, minWidth: 18 }}>{`${i + 1}.`}</Text>
          <Text style={{ flex: 1, color: color.silk, fontSize: font.body, lineHeight: 22 }}>{line}</Text>
        </View>
      ))}
      <Hint>{ONE_AT_A_TIME}</Hint>
      {untried ? <Note tone="warn">{untried}</Note> : null}
    </View>
  )
}

/*
 * The parts for one unit, each with what it is for and where to buy it, the
 * charger that is not on the list, and who makes them (not this app, which
 * gets nothing from the links). Before a unit is picked, the whole of it in a
 * few words: for a customer, offered the AM4 alone (`am4Only`), the AM4's
 * own list, with nothing in it about other units. For the FM3, nothing to
 * buy, and a pointer to the warning in How to plug it in rather than the
 * same red box twice.
 */
function Buy({ unit, am4Only = false }) {
  if (!unit) return <Hint>{am4Only ? GEAR_IN_SHORT_AM4 : GEAR_IN_SHORT}</Hint>
  if (warningFor(unit)) return <Hint>Not for the FM3. How to plug it in, above, says why.</Hint>
  return (
    <View style={{ gap: space.md }}>
      {partsFor(unit, deviceNoun()).map((p) => (
        <View key={p.key} style={{ gap: space.xs }}>
          <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>{p.name}</Text>
          <Hint>{p.does}</Hint>
          <Press
            label="View on Amazon"
            height={44}
            accessibilityLabel={`View the ${p.name} on Amazon`}
            onPress={() => openLink(p.amazon)}
          />
        </View>
      ))}
      <Hint>{POWER_LINE}</Hint>
      <Hint>{SELLERS_LINE}</Hint>
    </View>
  )
}

/*
 * A row that opens what is under it, and closes it again: its name, and
 * under the name what a tap does. A Press like every other button here, so
 * it is in the tap log and has the haptic.
 */
function Fold({ title, open, onToggle, children }) {
  return (
    <View style={{ gap: space.md }}>
      <Press label={title} sub={open ? 'Tap to hide' : 'Tap to show'} height={52} onPress={onToggle} />
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
