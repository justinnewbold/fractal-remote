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
import { deviceNoun } from '../lib/device-word'

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
 *
 * And in the tempo box, the same switch: "can we add the metronome on and off
 * to this screen as well so they can quickly turn the metronome on and off?"
 * Not a copy — this component, so the box writes the unit exactly as the
 * volume pop-up and Settings do and says the same line about where the click
 * is. `compact` is how the box differs, and only in what it shows:
 *
 *   - No heading. The METRONOME title and the unit's BPM beside it sat under
 *     a field that is already headed TEMPO and already holds the number, and
 *     a second, different figure under the one being typed reads as the box
 *     disagreeing with itself.
 *   - One block of words under the button, not two. "The unit didn't take
 *     it" takes the line's place rather than coming in under it, so the box
 *     is no taller at the moment it has the most to say. The box sits above
 *     a number pad; a note that pushed it down would put itself under the
 *     keys exactly when it is needed.
 *   - `lines`, the most that block may take. The box asks for two on a small
 *     phone, where four lines of Bluetooth would otherwise reach the keys;
 *     the whole of it stays here in the volume pop-up and in Settings.
 *
 * The fault is never cut short: it is two lines, and it is the one thing then
 * that has to be read.
 */
export default function MetronomeSwitch({ compact = false, lines }) {
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
  const untilHeard = unitCan.can && setting.on && setting.where === 'unit' && !heard ? `Until the unit says its click is on, the ${deviceNoun()} keeps time as well.` : ''
  const noTempo = setting.on && clicks(setting, unitCan.can, heard).phone && !beatMs(bpm) ? `No tempo from the unit yet, so the ${deviceNoun()} has nothing to click to.` : ''
  const line = [where, untilHeard, noTempo].filter(Boolean).map(sentence).join(' ')

  return (
    <View style={{ gap: space.sm }}>
      {!compact ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text accessibilityRole="header" style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>
            METRONOME
          </Text>
          {Number.isFinite(bpm) ? (
            <Text style={{ color: color.silkDim, fontSize: font.body, fontFamily: face }}>{`${Math.round(bpm)} BPM`}</Text>
          ) : null}
        </View>
      ) : null}
      <Press label={setting.on ? 'Metronome on' : 'Metronome off'} tone="live" on={setting.on} height={TAP} onPress={toggle} />
      {compact && said ? (
        <Text accessibilityLiveRegion="polite" style={{ color: color.fault, fontSize: font.small, paddingHorizontal: space.sm }}>
          {said}
        </Text>
      ) : (
        <Text numberOfLines={compact ? lines : undefined} style={{ color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }}>
          {line}
        </Text>
      )}
      {!compact && said ? (
        <Note tone="fault" onDismiss={() => setSaid(null)}>
          {said}
        </Note>
      ) : null}
    </View>
  )
}
