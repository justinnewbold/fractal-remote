import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { sync, useStored } from '../lib/store'
import {
  VP4_SETUP,
  clearVp4Setup,
  readVp4Setup,
  saveVp4Setup,
  vp4ComputerCan,
  vp4OldFirmware
} from '../lib/vp4-safety'
import Note from './Note'
import Press from './Press'

/**
 * THE VP4'S SCENE SELECT NUMBER AND MIDI CHANNEL, on this phone.
 *
 * "I'm not sure why it wouldn't be possible to have the scenes go forward
 * and backwards that work immediately out of the box." Presets do: a VP4
 * takes a Program Change with nothing set up on its own channel 1, and one
 * moved to another channel saves that channel alone. Scenes cannot, because the
 * VP4 has no factory number for Scene Select — Fractal leaves it to the
 * player, in SETUP > MIDI/Remote — and a number the app guessed could be the
 * one the player put the volume or the tuner on. So this card asks for it,
 * once, with the steps to set it and the warning to pick one nothing else
 * uses, and keeps it on this phone for this unit (lib/vp4-safety). Every
 * word is VP4_SETUP's, which the browser's card says too.
 *
 * Only on a real VP4 (Settings decides), never the demo, and it sends
 * nothing: a save is kept here, and the next scene tap carries it.
 */
export default function Vp4Setup({ caps, firmware }) {
  useStored()
  const kept = readVp4Setup(sync)
  const [number, setNumber] = useState(kept.sceneCc === null ? '' : String(kept.sceneCc))
  const [channel, setChannel] = useState(String(kept.midiChannel))
  const [said, setSaid] = useState(null)
  const [wrong, setWrong] = useState(null)
  const can = vp4ComputerCan(caps)
  const old = vp4OldFirmware(firmware)

  const save = () => {
    const r = saveVp4Setup(sync, undefined, { sceneCc: number, midiChannel: channel })
    if (!r.ok) {
      setWrong(r.error)
      setSaid(null)
      return
    }
    setWrong(null)
    /* The number left empty saves the channel alone, for the presets (saveVp4Setup). */
    setSaid(r.setup.sceneCc === null ? VP4_SETUP.savedChannel : VP4_SETUP.saved)
  }
  const forget = () => {
    clearVp4Setup(sync)
    /* The channel stays: the presets go on it (clearVp4Setup). */
    setNumber('')
    setWrong(null)
    setSaid(VP4_SETUP.cleared)
  }

  const box = {
    minHeight: TAP,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.rule,
    backgroundColor: color.panel,
    color: color.silk,
    fontSize: font.body
  }
  const small = { color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }

  return (
    <View style={{ gap: space.md }}>
      {can ? null : <Note tone="warn">{VP4_SETUP.update}</Note>}
      {old ? <Note tone="warn">{old}</Note> : null}
      <Text style={{ color: color.silk, fontSize: font.body }}>{VP4_SETUP.intro}</Text>
      <Text style={small}>{VP4_SETUP.presets}</Text>
      <Note tone="hint">{VP4_SETUP.reload}</Note>

      <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>
        {VP4_SETUP.scenesHead}
      </Text>
      {VP4_SETUP.steps.map((step, i) => (
        <Text key={step} style={{ color: color.silk, fontSize: font.body }}>{`${i + 1}. ${step}`}</Text>
      ))}
      <Note tone="warn">{VP4_SETUP.freeNumber}</Note>

      <Text style={small}>{VP4_SETUP.numberLabel}</Text>
      <TextInput
        value={number}
        onChangeText={setNumber}
        keyboardType="number-pad"
        maxLength={3}
        placeholder="1–119"
        placeholderTextColor={color.silkFaint}
        accessibilityLabel={VP4_SETUP.numberLabel}
        style={box}
      />
      <Text style={small}>{VP4_SETUP.channelLabel}</Text>
      <TextInput
        value={channel}
        onChangeText={setChannel}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="1"
        placeholderTextColor={color.silkFaint}
        accessibilityLabel={VP4_SETUP.channelLabel}
        style={box}
      />
      <Text style={small}>{VP4_SETUP.channelNote}</Text>

      {kept.held ? <Note tone="fault">{VP4_SETUP.heldNote(kept.sceneCc)}</Note> : null}
      {wrong ? <Note tone="fault">{wrong}</Note> : null}
      {said ? <Note tone="hint">{said}</Note> : null}
      <Press label={VP4_SETUP.save} tone="signal" height={TAP} onPress={save} />
      {kept.sceneCc !== null ? <Press label={VP4_SETUP.clear} onPress={forget} /> : null}
    </View>
  )
}
