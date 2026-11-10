import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { color, font, radius, space, TAP } from '../lib/theme'
import { ANY_WAY_UP, clearSides } from '../lib/screenShape'
import { deviceNoun } from '../lib/device-word'
import { listsFor, sourceFor } from '../lib/lists'
import { nameOf, useNamesHeard } from '../lib/presetNames'
import { useStored } from '../lib/store'
import { useRig } from '../lib/rig'
import { tick } from '../lib/feedback'
import { keepNotes, noteSize, notesFor, stepNoteSize } from '../lib/notesHere'
import {
  NOTES_ADD,
  NOTES_EDIT,
  NOTES_EMPTY,
  NOTES_MAX,
  NOTES_NAME,
  NOTES_NOT_A_SONG,
  NOTES_NO_SETLIST,
  NOTE_SIZES,
  NOTE_SIZE_NAMES,
  notesHint,
  songNow
} from '../lib/songNotes'
import Press from './Press'

/*
 * A SONG'S NOTES, ON SCREEN (lib/songNotes has the rules and says where
 * they are kept; App.js says who has them, his account until features
 * SONG_NOTES_FOR_EVERYONE).
 *
 * "Song notes beside Play: lyrics, chords or cues for the current setlist
 * song in the other half." Three pieces, all drawn from here so they cannot
 * drift apart:
 *
 *   NotesBox   the one place notes are typed: a box over the top half of
 *              the screen, clear of the keyboard, opened from a song's row
 *              on the Setlists screen and from Add notes / Edit notes.
 *   NotesPage  the notes for the song the unit is on, in large type that
 *              scrolls, following the song as Previous and Next step: what
 *              the side shows, and what Stage view lays over its lower part.
 *   NotesSide  NotesPage as the tool beside Play, under its own title and
 *              Done, as every tool keeps its own.
 */

const ofSlug = (s) => s.deviceSlug
const ofPreset = (s) => s.preset
const DIM = 'rgba(0, 0, 0, 0.55)'

/**
 * THE BOX NOTES ARE TYPED IN. Nothing is kept until Save: a page of lyrics
 * written on every keystroke would write the device's storage a few hundred
 * times a song (the Setlists screen's name box learned the same). Cancel,
 * the glass round the box and Android's back all leave what was there.
 */
export function NotesBox({ open, device, listId, slot, title, onClose }) {
  const [text, setText] = useState('')
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const field = useRef(null)

  useEffect(() => {
    if (open) setText(notesFor(device, listId, slot))
  }, [open, device, listId, slot])

  const save = () => {
    tick()
    keepNotes(device, listId, slot, text)
    onClose()
  }

  return (
    <Modal visible={!!open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={ANY_WAY_UP}>
      {/* Not one element to a screen reader, or the whole box reads as a single Close and the field is never reached (components/NameBox). */}
      <Pressable accessible={false} onPress={onClose} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', paddingTop: Math.max(space.xl, insets.top + space.sm), ...clearSides(insets, space.lg), backgroundColor: DIM }}>
          <Pressable
            accessible={false}
            onPress={() => field.current?.focus()}
            style={{ width: '100%', maxWidth: 560, gap: space.md, padding: space.lg, borderRadius: radius.lg * 2, borderWidth: 1, borderColor: color.rule, backgroundColor: color.panel }}
          >
            <Text style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>{NOTES_NAME.toUpperCase()}</Text>
            {title ? (
              <Text numberOfLines={1} style={{ color: color.silk, fontSize: font.lead, fontWeight: '700' }}>
                {title}
              </Text>
            ) : null}
            <TextInput
              ref={field}
              autoFocus
              multiline
              value={text}
              onChangeText={setText}
              maxLength={NOTES_MAX}
              placeholder="Verse, chorus, a capo on 2, watch the drummer…"
              placeholderTextColor={color.silkFaint}
              accessibilityLabel={title ? `Notes for ${title}` : NOTES_NAME}
              textAlignVertical="top"
              style={{
                /* In the top half of the screen, whatever the keyboard takes of the rest. */
                height: Math.max(120, Math.min(320, height * 0.3)),
                backgroundColor: color.chassis,
                borderWidth: 1,
                borderColor: color.live,
                borderRadius: radius.md,
                padding: space.md,
                color: color.silk,
                fontSize: font.body
              }}
            />
            <Text style={{ color: color.silkDim, fontSize: font.small }}>
              {`${notesHint(deviceNoun())} ${text.length.toLocaleString('en-US')} of ${NOTES_MAX.toLocaleString('en-US')}.`}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Press grow label="Cancel" height={TAP} onPress={onClose} />
              <Press grow label="Save" tone="signal" on height={TAP} onPress={save} />
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}

/**
 * THE NOTES FOR THE SONG THE UNIT IS ON. Read from what is stored at every
 * draw (lib/store tells it when anything stored changes, and the rig when
 * the preset does), so Next lands on the next song's page with nothing
 * here to keep in step. With a preset on that is not one of the setlist's
 * songs it says so, and with no setlist on at all it says that: the list
 * does not offer the tool then, and a side left open is not left blank.
 */
export function NotesPage({ style }) {
  useStored()
  useNamesHeard()
  const device = useRig(ofSlug)
  const preset = useRig(ofPreset)
  const [editing, setEditing] = useState(false)
  const song = songNow({ source: sourceFor(device), lists: listsFor(device), current: preset?.number })
  const step = noteSize()
  if (!song) {
    return (
      <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Text style={{ color: color.silkDim, fontSize: font.lead, textAlign: 'center' }}>{NOTES_NO_SETLIST}</Text>
      </View>
    )
  }
  const text = song.slot === null ? '' : notesFor(device, song.list.id, song.slot)
  const name = song.slot === null ? '' : nameOf(song.slot) || ''
  const head = song.slot === null ? song.list.name : `${song.at} of ${song.count}${name ? ` · ${name}` : ''}`
  return (
    <View style={[{ flex: 1, gap: space.md }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text numberOfLines={1} style={{ flex: 1, color: color.silkDim, fontSize: font.small, fontWeight: '600' }}>
          {head}
        </Text>
        {/* Smaller and bigger, a thumb each, with the size they are at between them. */}
        <Press label="A−" height={44} labelSize={font.small} disabled={step <= 0} onPress={() => stepNoteSize(step, -1)} accessibilityLabel="Smaller notes" />
        <Text style={{ color: color.silkFaint, fontSize: font.micro, minWidth: 48, textAlign: 'center' }}>{NOTE_SIZE_NAMES[step]}</Text>
        <Press label="A+" height={44} labelSize={font.small} disabled={step >= NOTE_SIZES.length - 1} onPress={() => stepNoteSize(step, 1)} accessibilityLabel="Bigger notes" />
      </View>
      {song.slot === null ? (
        <Text style={{ color: color.silkDim, fontSize: font.body }}>{NOTES_NOT_A_SONG}</Text>
      ) : text ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.lg }}>
          <Text selectable style={{ color: color.silk, fontSize: NOTE_SIZES[step], lineHeight: Math.round(NOTE_SIZES[step] * 1.35) }}>
            {text}
          </Text>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
          <Text style={{ color: color.silkDim, fontSize: font.lead }}>{NOTES_EMPTY}</Text>
        </View>
      )}
      {song.slot === null ? null : <Press label={text ? NOTES_EDIT : NOTES_ADD} height={TAP} tone={text ? undefined : 'signal'} on={!text} onPress={() => setEditing(true)} />}
      <NotesBox open={editing} device={device} listId={song.list.id} slot={song.slot} title={name} onClose={() => setEditing(false)} />
    </View>
  )
}

/** NOTES AS THE TOOL BESIDE PLAY: its own title and Done over the page, as Setlists and All presets have theirs. */
export function NotesSide({ onBack }) {
  return (
    <View style={{ flex: 1, padding: space.lg, gap: space.md, backgroundColor: color.chassis }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
        <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}>
          {NOTES_NAME}
        </Text>
        <Press label="Done" height={40} onPress={onBack} />
      </View>
      <NotesPage />
    </View>
  )
}
