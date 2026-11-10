import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { color, font, mono, radius, space, TAP } from '../lib/theme'
import { capsule, classic, glassField } from '../lib/glass'
import { slotLabel } from '../lib/device'
import { SCENES, SONG_BPM, songIn, songsWith, songWords, updateList } from '../lib/lists'
import { useRig } from '../lib/rig'
import { tick } from '../lib/feedback'
import { notesFor } from '../lib/notesHere'
import { NOTES_ADD, NOTES_NAME, notesPeek } from '../lib/songNotes'
import Press from './Press'
import { NotesBox } from './SongNotes'

/**
 * WHAT EACH SONG SETS UP — the browser's SongSetup, here.
 *
 * "Make each song set itself up when you pick it." Next and Previous land on a
 * song's preset and then put this scene and this tempo on the unit, so one tap
 * is the whole change between songs. Either half may be left as the preset
 * has it. The rules are shared (lib/setlists.js: songsWith, applySong).
 *
 * AND ITS NOTES (`notes`: an account that has song notes, from App, his
 * until features SONG_NOTES_FOR_EVERYONE): lyrics, chords or cues, typed in
 * the one box they are typed in everywhere (components/SongNotes NotesBox)
 * and shown beside Play. Kept on this device, apart from the setlist (lib/
 * songNotes says why), so nothing about them goes through `save` below.
 * Without `notes` this draws exactly what it always drew.
 */
export default function SongSetup({ device, list, nameOf, addressing, notes = false }) {
  const bpmNow = useRig((s) => s.bpm)
  const [typing, setTyping] = useState({})
  /* The slot whose notes are being typed, or null. */
  const [noting, setNoting] = useState(null)
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
      /*
       * Each choice its own capsule of frosted glass (lib/glass), the gaps
       * between them kept; the chosen one keeps its amber edge and wash. The
       * light along the top only, no drop: there are nine on every song.
       */
      style={({ pressed }) => ({
        minHeight: TAP,
        minWidth: TAP,
        paddingHorizontal: space.sm,
        borderRadius: classic() ? radius.sm : capsule(TAP),
        borderWidth: 1,
        borderColor: on ? color.signal : color.glassRim,
        backgroundColor: on ? color.signalWash : pressed && !classic() ? color.glassFillHi : color.glassFill,
        boxShadow: color.glassTop,
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
        What each song sets when Next or Previous lands on it. Left as saved, it plays as its preset is saved.
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
          <View key={n} style={{ gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: color.glassRim }}>
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
                  borderWidth: 1,
                  /* A frosted glass field (lib/glass): rounded like a card, rimmed, no shadow. */
                  ...glassField(),
                  /* Classic: the box at the small corner on the sheet's own ground, as it was. */
                  ...(classic() ? { borderRadius: radius.sm, backgroundColor: undefined } : null),
                  color: color.silk,
                  fontSize: font.body
                }}
              />
              {now !== null ? chip(false, `Use ${now}`, () => save(n, { bpm: now }), 'now') : null}
            </View>
            {notes ? (
              /* The song's notes: their first line where it has some, and the box they are typed in. */
              <Press
                label={notesFor(device, list.id, n) ? NOTES_NAME : NOTES_ADD}
                sub={notesPeek(notesFor(device, list.id, n)) || 'Lyrics, chords or cues, shown beside Play'}
                height={TAP}
                onPress={() => setNoting(n)}
                accessibilityLabel={`${notesFor(device, list.id, n) ? NOTES_NAME : NOTES_ADD} for ${nameOf(n) || `preset ${n}`}`}
              />
            ) : null}
          </View>
        )
      })}
      {notes ? <NotesBox open={noting !== null} device={device} listId={list.id} slot={noting} title={noting === null ? '' : nameOf(noting) || ''} onClose={() => setNoting(null)} /> : null}
    </View>
  )
}
