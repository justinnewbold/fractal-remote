import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { notePresetName, noteSceneName, useRig } from '../lib/rig'
import { sceneShape, setPresetName, setSceneName } from '../lib/device'
import Note from './Note'
import SceneCopy from './SceneCopy'
import { SaveButton, SaveNotes, useSaveToSlot } from './SaveToSlot'

/**
 * Rename the preset, and rename its scenes.
 *
 * "Would also like to be able to rename presets and scenes in the app directly
 * without having to ask the chat."
 *
 * Both write the unit's EDIT BUFFER, like everything else this app does. The
 * new name is real the moment you type it and permanent once the preset is
 * saved to a slot — which the Save button below the names asks the computer
 * to do, because a phone is not allowed to overwrite a slot and should not be.
 *
 * AND THE WRITE IS BELIEVED. "Renaming a preset doesn't work, just goes right
 * back to the original name." The rename landed; the re-read that followed
 * came back with the old name and put it back on screen. So the screen is
 * told the name it wrote, rather than asked to read it back. See
 * rig.notePresetName. (It also sent DELETE /device/cache, to "drop the
 * computer's cache" — which deleted the computer's saved profile of the FM3
 * and left any name where it was, so it is gone.)
 *
 * ON THE EDIT SCREEN, next to the preset it renames. It lived in Settings —
 * "move the rename presets and scenes button to the settings menu" — and
 * then: "I think we should move rename presets and scenes out of settings
 * onto the edit screen." Settings is for how the app behaves; a preset's
 * name is part of the preset. Still not on the stage screen: renaming is
 * bench work, and the stage is the screen a thumb crosses between songs.
 */
export default function RenamePreset() {
  const preset = useRig((st) => st.preset)
  const scenes = useRig((st) => st.sceneNames)
  const caps = useRig((st) => st.capabilities)
  const unsaved = useRig((st) => st.unsaved)
  const shape = sceneShape(caps)
  const pending = !!unsaved && unsaved.number === preset?.number

  const [said, setSaid] = useState(null)
  const [failed, setFailed] = useState(null)
  const saveTo = useSaveToSlot()

  const rename = async (name) => {
    const wanted = name.trim()
    if (!wanted || wanted === (preset?.name || '').trim()) return
    setFailed(null)
    try {
      await setPresetName(wanted)
      notePresetName(wanted)
      setSaid(`This preset is called ${wanted} now. Tap Save to keep it.`)
    } catch (err) {
      setFailed(err.message)
    }
  }

  const renameScene = async (index, name) => {
    const wanted = name.trim()
    if (!wanted || wanted === (scenes[index] || '').trim()) return
    setFailed(null)
    try {
      await setSceneName(index, wanted)
      noteSceneName(index, wanted)
      setSaid(`Scene ${index + 1} is called ${wanted} now. Tap Save to keep it.`)
    } catch (err) {
      setFailed(err.message)
    }
  }

  return (
    <View style={{ gap: space.md }}>
      {failed ? <Note tone="fault">{failed}</Note> : null}

      <NameField
        label="Preset name"
        value={preset?.name || ''}
        onDone={rename}
      />

      {shape.hasScenes
        ? Array.from({ length: shape.count }, (_, i) => (
            <NameField
              key={i}
              label={`Scene ${i + 1}`}
              value={scenes[i] || ''}
              onDone={(name) => renameScene(i, name)}
            />
          ))
        : null}

      {/* Start a scene from another one. See SceneCopy. */}
      {shape.hasScenes ? <SceneCopy count={shape.count} /> : null}

      {said ? <Note>{said}</Note> : null}
      {pending ? (
        <Note tone="warn">
          Renamed, not saved. Tap Save to keep the new names. Changing preset drops them, on the
          unit and here.
        </Note>
      ) : null}
      <SaveNotes s={saveTo} />
      <SaveButton s={saveTo} height={TAP} grow waiting={pending} />
      <Note>
        A new name is on the unit straight away and is lost on the next preset change unless it is
        saved. Save asks the computer to write this slot, and that keeps everything changed from this
        phone: names, knobs, blocks and the chain.
      </Note>
    </View>
  )
}

/**
 * One name, as a field you can type in.
 *
 * Held locally while it is being typed. A box bound straight to what the unit
 * says snapped back to the old name the moment the last letter was deleted, so
 * you could not clear it to type a new one.
 */
function NameField({ label, value, onDone }) {
  const [draft, setDraft] = useState(null)
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.2 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={draft ?? value}
        onChangeText={setDraft}
        onBlur={() => {
          if (draft !== null) onDone(draft)
          setDraft(null)
        }}
        onSubmitEditing={() => {
          if (draft !== null) onDone(draft)
          setDraft(null)
        }}
        returnKeyType="done"
        accessibilityLabel={label}
        placeholder="Untitled"
        placeholderTextColor={color.silkFaint}
        style={{
          minHeight: TAP,
          paddingHorizontal: space.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: color.rule,
          backgroundColor: color.panel,
          color: color.silk,
          fontSize: font.body
        }}
      />
    </View>
  )
}
