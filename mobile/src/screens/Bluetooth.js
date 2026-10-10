import { useEffect, useState } from 'react'
import { Linking, Platform, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { color, font, mono, radius, space } from '../lib/theme'
import { APP_VERSION } from '../lib/version'
import { BLE_UNITS, WAYS } from '../lib/bleWire'
import {
  ALLOW_WORDS,
  RESTRICTED_WORDS,
  adapterDevices,
  checkSteps,
  chooseAdapter,
  findAdapters,
  forgetAdapter,
  methodsFor,
  runCheck,
  setBluetooth,
  setBluetoothUnit,
  setMethods,
  unitName,
  useBluetooth
} from '../lib/bluetooth'
import {
  BETA_NOTE,
  FIRST_TIME,
  GEAR_IN_SHORT,
  GUIDE_URL,
  PLUGS_CHECK,
  POWER_LINE,
  hookupFor,
  partsFor,
  untriedLine
} from '../lib/bluetooth-gear'
import { useRig } from '../lib/rig'
import { mayDrive } from '../lib/unlock-rule'
import Note from '../components/Note'
import Press from '../components/Press'

/**
 * Settings → Phone & computer → Bluetooth (beta).
 *
 * The phone talking straight to the unit, through a Bluetooth MIDI adapter
 * plugged into the unit's MIDI In and Out, with no computer anywhere.
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
 * WHAT YOU NEED sits between the two, where somebody setting up reads it
 * before Connect: the parts, each with where to buy it, and how they plug
 * together for the unit picked in step 1 (lib/bluetooth-gear, from
 * shared/bluetooth-gear.mjs, which the website's guide is held to as well).
 * Folded away once an adapter has been used, so coming back to Connect is
 * still two steps and one button.
 *
 * A PUBLIC BETA, and it says so first. "Let's just say that Bluetooth is
 * beta though in the app and give like a disclaimer saying that Bluetooth
 * might not function correctly." It is open to everybody who has unlocked
 * the app; it has been tried on one AM4.
 *
 * What it cannot do comes after, and the check, for finding out what a real
 * unit does, is folded away under Testing tools.
 *
 * THE CHECK IS FOR TESTING, and says so. Nobody here has every unit to try
 * it on, so where a unit might ignore a command both ways of sending it are
 * in here; the check tries them, shows the bytes that went out and came
 * back, and remembers what worked. "How each command is sent" can force
 * either. Rough edges are deliberate: it is a bench instrument.
 *
 * Drawn inside Settings' own scroll view, under its head: no scroll view and
 * no Done of its own.
 */

const face = Platform.select(mono)
const ios = Platform.OS === 'ios'

/* What a player loses by leaving the cable at home, in the order it is noticed. */
const DIFFERENT = [
  'No editing or saving over Bluetooth.',
  'Slower to load the preset list.',
  'Footswitch changes may take a moment to show.',
  'About 30 feet of range.',
  'The adapter connects to one thing at a time.',
  'On the AM4, scene names don’t show over Bluetooth.',
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
  if (b.trouble === 'bluetooth-off') return { line: 'Turn on Bluetooth in the phone’s settings', tone: 'fault' }
  if (b.trouble === 'permission') return { line: ALLOW_WORDS, tone: 'fault' }
  if (b.trouble === 'restricted') return { line: RESTRICTED_WORDS, tone: 'fault' }
  if (!b.on) return { line: 'Off', tone: 'dim' }
  if (b.phase === 'locked') return { line: 'Unlock the app to connect to your unit', tone: 'fault' }
  if (!b.unit || b.phase === 'no-unit') return { line: 'Pick your unit', tone: 'dim' }
  if (!b.adapter || b.phase === 'no-adapter') return { line: 'No adapter yet. Tap Stop, then Connect.', tone: 'dim' }
  if (b.phase === 'held') return { line: 'Disconnected', tone: 'dim' }
  if (b.phase === 'connected') {
    /* The wrong unit picked: the phone has stopped sending to it, and this is the way out. */
    if (b.answeredAs) {
      return {
        line: `An ${b.answeredAs} answered, not the ${name}. Tap Stop, pick ${b.answeredAs} in step 1, then tap Connect.`,
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

export default function BluetoothPage({ purchase }) {
  const b = useBluetooth()
  const unitState = useRig((s) => s.unit)
  const said = status(b, unitState)
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
  useEffect(() => {
    if (!wanted || !b.adapter || !b.unit || b.on) return
    setWanted(false)
    if (mayDrive(purchase)) setBluetooth(true)
  }, [wanted, b.adapter?.id, b.unit, b.on, purchase])

  const canStart = !!b.unit && mayDrive(purchase)
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

  /* The list is only for a real choice: no adapter chosen yet, and some to choose from. */
  const showList = !b.on && !b.adapter && b.devices.length > 0
  const [tools, setTools] = useState(false)
  /* What you need: open for the first setting up, folded once an adapter has been used here. */
  const [gear, setGear] = useState(!b.adapter)

  return (
    <View style={{ gap: space.xl }}>
      {/* The beta, said before anything else on the page: what it is, where it has been tried, and the way back. */}
      <Note tone="warn">{BETA_NOTE}</Note>
      <Text style={{ color: color.silk, fontSize: font.body + 1, lineHeight: 24 }}>
        The phone talks straight to your unit through a Bluetooth MIDI adapter plugged into its MIDI In and MIDI Out.
        Presets, scenes, names, effects on and off, channels, tempo and the tuner. No editing or saving, and the
        computer isn’t used.
      </Text>

      {/*
        STEP 1. Not while it is on: a tap here while connected would send the
        new unit's messages straight away to whatever is on the adapter, and
        one mis-tap is enough; the AM4 has frozen on messages it did not
        expect. With it off nothing is connected to send to.
      */}
      <View style={{ gap: space.sm }}>
        <Heading>1 · Which unit is the adapter plugged into?</Heading>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {BLE_UNITS.map((u) => (
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
        {b.on ? <Hint>To change the unit, tap Stop first.</Hint> : null}
      </View>

      {/*
        WHAT YOU NEED, AND HOW IT PLUGS IN. "We need to provide as much
        instructions as possible on how to connect it and hook it up… Maybe
        we could add these with the Amazon links on how to buy them?" After
        the unit, because the parts and the plugs differ by unit (the AM4's
        jacks are small 3.5 mm ones and need the adapters), and before
        Connect, because none of it works until it is plugged in. Before a
        unit is picked, the whole of it in a few words. The rest, from the
        lights on the Uhost to what to do when nothing answers, is on the
        website's guide, one tap away.
      */}
      <View style={{ gap: space.sm }}>
        <Heading>What you need</Heading>
        {gear && b.unit ? <Gear unit={b.unit} /> : null}
        {gear && !b.unit ? <Hint>{GEAR_IN_SHORT}</Hint> : null}
        {gear ? null : <Press label="Show the parts and how they plug in" height={44} onPress={() => setGear(true)} />}
        <Press label="Full setup guide" height={44} onPress={() => openLink(GUIDE_URL)} />
      </View>

      {/* STEP 2. One button: Connect, or Stop once it is on. */}
      <View style={{ gap: space.sm }}>
        <Heading>2 · Connect</Heading>
        {b.on ? (
          <View style={{ gap: space.sm }}>
            <Text accessibilityLiveRegion="polite" style={{ color: TONES[said.tone](), fontSize: font.body + 1, lineHeight: 24 }}>
              {said.line}
            </Text>
            {/* Allowing it can be lost while on (Android, from its settings): the way back, under the line that says so. */}
            {b.trouble === 'permission' ? <OpenSettings /> : null}
            {/* The usual reasons a connected adapter hears nothing back: the two plugs swapped, or an adapter that only carries one way. */}
            {b.on && b.phase === 'connected' && !b.answeredAs && (unitState === 'missing' || unitState === 'silent') ? (
              <Hint>
                {`${PLUGS_CHECK} The adapter has to carry MIDI both ways. One with a single plug, in one MIDI jack, only carries one way: use one with two plugs, in the unit’s MIDI In and MIDI Out.`}
              </Hint>
            ) : null}
            {b.on && b.phase === 'connecting' ? (
              <Hint>
                {ios
                  ? 'If this stays here, tap Stop, then Connect, and connect the adapter again in Apple’s screen.'
                  : 'If this stays here, check the phone’s Bluetooth is on, and that the adapter is plugged in and lit.'}
              </Hint>
            ) : null}
            <Press label="Stop using Bluetooth" onPress={() => setBluetooth(false)} />
            <Hint>While Bluetooth is on, the phone does not use the computer at all. Stop goes back to the computer.</Hint>
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <Press
              label={b.looking ? 'Looking…' : b.adapter ? `Connect to ${b.adapter.name || 'the adapter'}` : 'Connect'}
              tone="live"
              disabled={!canStart || b.looking}
              onPress={start}
            />
            <Hint>
              {!b.unit
                ? 'Pick your unit first, just above.'
                : b.adapter
                  ? 'Uses the adapter from last time.'
                  : ios
                    ? 'Apple’s Bluetooth screen opens. Tap your adapter, wait until it says Connected, then tap Done. The phone does the rest.'
                    : 'The phone looks for the adapter for ten seconds, then connects to it. If Android asks to pair with it, accept.'}
            </Hint>
            {b.adapter ? <Press label="Use a different adapter" height={44} disabled={!canStart || b.looking} onPress={another} /> : null}
          </View>
        )}
        {/*
          NOT ALLOWED, AND THE WAY TO ALLOW IT, one tap away, directly under
          the line that says what to change: never on its own, and never
          while Bluetooth is on, when this line is not drawn (the one at the
          top of the step says it then, with its own button). Not for
          'restricted' either, whose line says the block is somewhere the
          app's own page cannot reach.
        */}
        {!b.on && b.trouble ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: color.fault, fontSize: font.body, lineHeight: 22 }}>{said.line}</Text>
            {b.trouble === 'permission' ? <OpenSettings /> : null}
          </View>
        ) : null}
        {/* Not under the line above it, which already says what is wrong. */}
        {!b.on && missed && !b.adapter && !b.trouble ? (
          <Text style={{ color: color.fault, fontSize: font.body, lineHeight: 22 }}>
            No adapter was connected. Check Bluetooth is on, and allowed for Fractal Remote in the iPhone’s Settings. Then
            tap Connect again, and in Apple’s screen tap your adapter and wait for Connected before Done.
          </Text>
        ) : null}
        {b.said ? <Note tone="warn">{b.said}</Note> : null}

        {showList ? (
          <View style={{ gap: space.sm }}>
            <Hint>{b.looking ? 'Found so far. Tap yours:' : 'More than one is here. Tap yours:'}</Hint>
            {b.devices.map((d) => {
              const detail = ios ? (d.offline ? 'not connected to this phone' : d.fresh ? 'just connected' : '') : signal(d.rssi)
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

      <View style={{ gap: space.sm }}>
        <Heading>What’s different from USB</Heading>
        {DIFFERENT.map((line) => (
          <View key={line} style={{ flexDirection: 'row', gap: space.sm }}>
            <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: 22 }}>•</Text>
            <Text style={{ flex: 1, color: color.silk, fontSize: font.body, lineHeight: 22 }}>{line}</Text>
          </View>
        ))}
      </View>

      {/* For finding out what a real unit does: out of the way until asked for. */}
      {b.unit ? (
        <Press label={tools ? 'Hide testing tools' : 'Testing tools'} height={44} onPress={() => setTools(!tools)} />
      ) : null}
      {b.unit && tools ? (
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
 * The parts for one unit, each with where to buy it, then the Uhost's
 * first-time update, then how they plug together, in the gear file's own
 * words. A unit nobody has tried it on yet says so under the steps rather
 * than being promised to work.
 */
function Gear({ unit }) {
  const steps = hookupFor(unit) || []
  const untried = untriedLine(unit)
  return (
    <View style={{ gap: space.md }}>
      {partsFor(unit).map((p) => (
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
      {/* Once, before any of the plugging in: the Uhost's firmware, which the steps below take for granted. */}
      <Hint>{FIRST_TIME}</Hint>
      <Heading>How it plugs in</Heading>
      {steps.map((line, i) => (
        <View key={line} style={{ flexDirection: 'row', gap: space.sm }}>
          <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: 22, minWidth: 18 }}>{`${i + 1}.`}</Text>
          <Text style={{ flex: 1, color: color.silk, fontSize: font.body, lineHeight: 22 }}>{line}</Text>
        </View>
      ))}
      {untried ? <Note tone="warn">{untried}</Note> : null}
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
