import { useState } from 'react'
import { Platform, Text, View } from 'react-native'

import { color, font, mono, space, TAP } from '../lib/theme'
import Note from './Note'
import Press from './Press'
import { setMetronome, useMetronome, useUnitHeardOn } from '../lib/metronome'
import { PLACES, beatMs, clicks, placeLit, unitClick } from '../lib/metronome-rules'
import { useRig } from '../lib/rig'
import { useDemo } from '../lib/demo'
import { useBluetoothOn } from '../lib/bluetooth'

const face = Platform.select(mono)
const ofSlug = (s) => s.deviceSlug
const ofBpm = (s) => s.bpm
/* Each part a sentence: the place notes are written as labels, with no full stop. */
const sentence = (t) => (/[.!?]$/.test(t) ? t : `${t}.`)

/**
 * THE METRONOME, ON AND OFF, IN THE VOLUME POP-UP.
 *
 * "Make it so the metronome can be turned on and off in the volume section
 * of the app." The volume pop-up is the one thing on Play that opens over
 * the screen for a moment and goes again, which is exactly how a click is
 * wanted between songs: on for the count-in, off for the song.
 *
 * Only on and off. Where it clicks (Unit, Phone, Both) is chosen once, in
 * Settings → Metronome, and this says which in a line. The unit is written
 * exactly as Settings writes it — the same setMetronome, the same "here" —
 * so the two can never disagree about whether the unit's own click was told.
 */
export default function MetronomeSwitch() {
  const setting = useMetronome()
  const slug = useRig(ofSlug)
  const bpm = useRig(ofBpm)
  const demo = useDemo()
  const bluetooth = useBluetoothOn()
  /* The same "here" as Settings → Metronome: not over Bluetooth, not on an AM4, not in the demo. */
  const clickHere = { bluetooth: bluetooth && !demo, demo }
  const unitCan = unitClick(slug, clickHere)
  const heard = useUnitHeardOn(slug)
  const [said, setSaid] = useState(null)

  const toggle = async () => {
    setSaid(null)
    const answer = await setMetronome({ on: !setting.on }, slug, clickHere)
    if (answer?.ok === false && !answer?.unsupported) setSaid('The unit didn’t take it. Check it’s connected, then try again.')
  }

  const where = unitCan.can ? PLACES.find((p) => placeLit(setting, p.key, true))?.note || '' : unitCan.why
  const untilHeard = unitCan.can && setting.on && setting.where === 'unit' && !heard ? 'Until the unit says its click is on, the phone keeps time as well.' : ''
  const noTempo = setting.on && clicks(setting, unitCan.can, heard).phone && !beatMs(bpm) ? 'No tempo from the unit yet, so the phone has nothing to click to.' : ''
  const line = [where, untilHeard, noTempo].filter(Boolean).map(sentence).join(' ')

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>
          METRONOME
        </Text>
        {Number.isFinite(bpm) ? (
          <Text style={{ color: color.silkDim, fontSize: font.body, fontFamily: face }}>{`${Math.round(bpm)} BPM`}</Text>
        ) : null}
      </View>
      <Press label={setting.on ? 'Metronome on' : 'Metronome off'} tone="live" on={setting.on} height={TAP} onPress={toggle} />
      <Text style={{ color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }}>{line}</Text>
      {said ? (
        <Note tone="fault" onDismiss={() => setSaid(null)}>
          {said}
        </Note>
      ) : null}
    </View>
  )
}
