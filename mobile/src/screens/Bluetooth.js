import { useState } from 'react'
import { Platform, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'

import { color, font, mono, radius, space } from '../lib/theme'
import { APP_VERSION } from '../lib/version'
import { BLE_UNITS, WAYS } from '../lib/bleWire'
import {
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
import { holdBluetooth, pokeBluetooth } from '../lib/bleLink'
import { useRig } from '../lib/rig'
import { mayDrive } from '../lib/unlock-rule'
import Note from '../components/Note'
import Press from '../components/Press'

/**
 * Settings → Phone & computer → Bluetooth (beta).
 *
 * The phone talking straight to the unit, through a Bluetooth MIDI adapter
 * plugged into the unit's MIDI In and Out, with no computer anywhere. Top to
 * bottom it is the order somebody sets it up in: what it is and what it
 * cannot do, the switch, which unit, which adapter, whether it is working,
 * and then the check, which is for finding out what a real unit does.
 *
 * THE CHECK IS FOR TESTING, and says so. This build takes no updates over
 * the air, so where a unit might ignore a command both ways of sending it
 * are in here; the check tries them, shows the bytes that went out and came
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
  'On the AM4, scene names don’t show over Bluetooth.'
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
  if (b.trouble === 'permission') return { line: 'Allow Nearby devices for Fractal Remote in Android’s settings', tone: 'fault' }
  if (!b.on) return { line: 'Off', tone: 'dim' }
  if (b.phase === 'locked') return { line: 'Unlock the app to connect to your unit', tone: 'fault' }
  if (!b.unit || b.phase === 'no-unit') return { line: 'Pick your unit', tone: 'dim' }
  if (!b.adapter || b.phase === 'no-adapter') return { line: 'Find the adapter, above', tone: 'dim' }
  if (b.phase === 'held') return { line: 'Disconnected', tone: 'dim' }
  if (b.phase === 'connected') {
    /* The wrong unit picked: the phone has stopped sending to it, and this is the way out. */
    if (b.answeredAs) {
      return {
        line: `An ${b.answeredAs} answered, not the ${name}. Turn Use Bluetooth off, pick ${b.answeredAs} under Your unit, then turn it back on.`,
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

const TONES = { ok: () => color.ok, fault: () => color.fault, dim: () => color.silkDim }

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

  return (
    <View style={{ gap: space.xl }}>
      <Text style={{ color: color.silk, fontSize: font.body + 1, lineHeight: 24 }}>
        For trying out. The phone talks straight to your unit through a Bluetooth MIDI adapter plugged into its MIDI
        In and MIDI Out. Presets, scenes, names, effects on and off, channels, tempo and the tuner. No editing or
        saving, and the computer isn’t used.
      </Text>

      <View style={{ gap: space.sm }}>
        <Heading>What’s different from USB</Heading>
        {DIFFERENT.map((line) => (
          <View key={line} style={{ flexDirection: 'row', gap: space.sm }}>
            <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: 22 }}>•</Text>
            <Text style={{ flex: 1, color: color.silk, fontSize: font.body, lineHeight: 22 }}>{line}</Text>
          </View>
        ))}
      </View>

      {/* The switch. Not before a unit is picked: see lib/bluetooth's SAVED. */}
      <View style={{ gap: space.sm }}>
        <Press
          label={b.on ? 'Use Bluetooth: on' : 'Use Bluetooth: off'}
          tone="live"
          on={b.on}
          disabled={!b.on && (!b.unit || !mayDrive(purchase))}
          onPress={() => setBluetooth(!b.on)}
        />
        {!b.unit ? <Hint>Pick your unit first, just below.</Hint> : null}
        {b.on ? <Hint>While this is on, the phone does not use the computer at all.</Hint> : null}
      </View>

      {/*
        Not while it is on. A tap here while connected would send the new
        unit's messages straight away to whatever is on the adapter, and one
        mis-tap is enough; the AM4 has frozen on messages it did not expect.
        With the switch off nothing is connected to send to.
      */}
      <View style={{ gap: space.sm }}>
        <Heading>Your unit</Heading>
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
        <Hint>The one the adapter is plugged into. The phone only ever talks to the unit picked here.</Hint>
        {b.on ? <Hint>To change the unit, turn Use Bluetooth off first.</Hint> : null}
      </View>

      <View style={{ gap: space.sm }}>
        <Heading>Adapter</Heading>
        {b.adapter ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>
              {b.connectedTo || b.adapter.name || 'The adapter you picked'}
            </Text>
            {b.on && b.phase === 'held' ? <Press label="Connect" onPress={pokeBluetooth} /> : null}
            {b.on && (b.phase === 'connected' || b.phase === 'connecting') ? (
              <Press label="Disconnect" onPress={holdBluetooth} />
            ) : null}
            <Press label="Forget this adapter" onPress={forgetAdapter} />
          </View>
        ) : null}
        <Press
          label={ios ? 'Find the adapter' : b.looking ? 'Looking…' : 'Look for adapters'}
          disabled={b.looking}
          onPress={findAdapters}
        />
        <Hint>
          {ios
            ? 'Opens Apple’s Bluetooth screen. Connect the adapter there, press Done, then pick it below.'
            : 'Looks for ten seconds. Pick the adapter when it shows up.'}
        </Hint>
        {b.devices.map((d) => {
          const chosen = d.id === b.adapter?.id
          const detail = ios ? (d.offline ? 'not connected to this phone' : d.fresh ? 'just connected' : '') : signal(d.rssi)
          return (
            <View
              key={d.id}
              style={{
                gap: space.sm,
                padding: space.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: color.rule,
                backgroundColor: color.panel
              }}
            >
              <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>{d.name || 'An adapter with no name'}</Text>
              {detail ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{detail}</Text> : null}
              {chosen ? (
                <Text style={{ color: color.ok, fontSize: font.small }}>This is the one in use.</Text>
              ) : (
                <Press label="Use this one" height={44} onPress={() => chooseAdapter(d)} />
              )}
            </View>
          )
        })}
      </View>

      <View style={{ gap: space.sm }}>
        <Heading>Status</Heading>
        <Text accessibilityLiveRegion="polite" style={{ color: TONES[said.tone](), fontSize: font.body + 1, lineHeight: 24 }}>
          {said.line}
        </Text>
        {b.said ? <Note tone="warn">{b.said}</Note> : null}
        {/* An iPhone forgets an adapter it has not used for a while, and only
            Apple's screen can connect it again: the app is not allowed to.
            Android cannot tell the phone's Bluetooth being off from the
            adapter being out of range, so it names both. */}
        {b.on && b.phase === 'connecting' ? (
          <Hint>
            {ios
              ? 'If this stays here, press Find the adapter and connect it again in Apple’s screen.'
              : 'If this stays here, check the phone’s Bluetooth is on, and that the adapter is plugged in and lit.'}
          </Hint>
        ) : null}
      </View>

      {b.unit ? (
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
