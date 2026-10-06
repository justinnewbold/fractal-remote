import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { color, font, mono, radius, space, TAP } from '../lib/theme'
import { slotLabel } from '../lib/device'
import { SCENES, SONG_BPM, songIn, songsWith, songWords, updateList } from '../lib/lists'
import { useRig } from '../lib/rig'
import { tick } from '../lib/feedback'

/**
 * WHAT EACH SONG SETS UP — the browser's SongSetup, here.
 *
 * "Make each song set itself up when you pick it." Next and Previous land on a
 * song's preset and then put this scene and this tempo on the unit, so one tap
 * is the whole change between songs. Either half may be left as the preset
 * has it. The rules are shared (lib/setlists.js: songsWith, applySong).
 */
export default function SongSetup({ device, list, nameOf, addressing }) {
  const bpmNow = useRig((s) => s.bpm)
  const [typing, setTyping] = useState({})
  if (!list || !list.presets.length) return null

  const save = (slot, patch) => {
    tick()
    updateList(device, list.id, { songs: songsWith(list, slot, patch) })
  }
  const now = Number.isFinite(bpmNow) && bpmNow >= SONG_BPM.min && bpmNow <= SONG_BPM.max ? Math.round(bpmNow) : null

  const chip = (on, label, onPress, key) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => ({
        minHeight: TAP,
        minWidth: TAP,
        paddingHorizontal: space.sm,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: on ? color.signal : color.rule,
        backgroundColor: on ? color.signalWash : color.panel,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1
      })}
    >
      <Text style={{ color: on ? color.signal : color.silk, fontSize: font.small, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  )

  return (
    <View style={{ gap: space.md }}>
      <Text style={{ color: color.silkDim, fontSize: font.small }}>
        What each song sets up when Next or Previous lands on it. Leave it as saved and the song plays as its preset is
        saved.
      </Text>
      {list.presets.map((n, i) => {
        const song = songIn(list, n) || {}
        const typed = typing[n] ?? (Number.isFinite(song.bpm) ? String(song.bpm) : '')
        const commit = () => {
          const raw = String(typed).trim()
          const bpm = raw === '' ? null : Math.round(Number(raw))
          setTyping((t) => ({ ...t, [n]: undefined }))
          if (bpm === null || (bpm >= SONG_BPM.min && bpm <= SONG_BPM.max)) save(n, { bpm })
        }
        return (
          <View key={n} style={{ gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: color.rule }}>
            <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '600' }}>
              {`${i + 1}. `}
              <Text style={{ fontFamily: mono }}>{slotLabel(n, addressing)}</Text>
              {`  ${nameOf(n) || 'Unnamed'}`}
            </Text>
            {songWords(song) ? <Text style={{ color: color.signal, fontSize: font.small }}>{songWords(song)}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {chip(!Number.isInteger(song.scene), 'As saved', () => save(n, { scene: null }), 'saved')}
              {Array.from({ length: SCENES }, (_, k) => chip(song.scene === k, String(k + 1), () => save(n, { scene: k }), k))}
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <TextInput
                value={typed}
                onChangeText={(t) => setTyping((was) => ({ ...was, [n]: t.replace(/[^0-9]/g, '') }))}
                onBlur={commit}
                onSubmitEditing={commit}
                keyboardType="number-pad"
                returnKeyType="done"
                accessibilityLabel={`Tempo for ${nameOf(n) || `preset ${n}`}`}
                placeholder="BPM as saved"
                placeholderTextColor={color.silkFaint}
                style={{
                  flex: 1,
                  minHeight: TAP,
                  paddingHorizontal: space.md,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: color.rule,
                  color: color.silk,
                  fontSize: font.body
                }}
              />
              {now !== null ? chip(false, `Use ${now}`, () => save(n, { bpm: now }), 'now') : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}
