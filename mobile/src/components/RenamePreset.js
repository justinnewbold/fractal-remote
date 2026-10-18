import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'

import { color, font, isDark, radius, space, TAP } from '../lib/theme'
import { notePresetName, noteSceneName, useRig } from '../lib/rig'
import { presetLabel, sceneShape, setPresetName, setSceneName, slotLabel } from '../lib/device'
import { sceneColor } from '../lib/sceneColors'
import { sceneTarget } from '../lib/colourPage'
import { inkOn, paperEdge } from '../lib/ink'
import { tick } from '../lib/feedback'
import Note from './Note'
import SceneCopy from './SceneCopy'
import ColourSheet from './ColourSheet'
import { SaveButton, SaveNotes, useSaveToSlot } from './SaveToSlot'
import { deviceNoun } from '../lib/device-word'

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
  /* The scene whose colour the colour sheet is open on, or null. */
  const [painting, setPainting] = useState(null)
  /* This preset, as the colour sheet names it: "012 Lead Rig". */
  const here = Number.isInteger(preset?.number)
    ? { number: preset.number, words: `${slotLabel(preset.number, caps?.presets?.addressing)} ${presetLabel(preset)}` }
    : undefined

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

      {/*
        EACH SCENE'S COLOUR, beside its name, for this preset: Fractal's own
        PERFORM layout makes Clean green, Crunch yellow and Lead red in the
        one preset that wants them, and this is where a preset's scenes are
        named, so it is where they are coloured. The sheet opens on "Just this
        preset" and offers every preset too (lib/colourPage sceneTarget).
      */}
      {shape.hasScenes
        ? Array.from({ length: shape.count }, (_, i) => (
            <NameField
              key={i}
              label={`Scene ${i + 1}`}
              value={scenes[i] || ''}
              onDone={(name) => renameScene(i, name)}
              colour={
                here
                  ? {
                      fill: sceneColor(i, here.number).fill,
                      said: `Colour for scene ${i + 1} in this preset`,
                      onPress: () => setPainting(sceneTarget(i, { preset: here, only: true, called: scenes[i] }))
                    }
                  : null
              }
            />
          ))
        : null}
      <ColourSheet target={painting} onClose={() => setPainting(null)} />

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
        saved. Save asks the computer to write this slot, and that keeps everything changed from this{' '}
        {deviceNoun()}: names, knobs, blocks and the chain.
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
function NameField({ label, value, onDone, colour = null }) {
  const [draft, setDraft] = useState(null)
  return (
    <View style={{ gap: space.xs }}>
      <Text style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.2 }}>
        {label.toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
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
            fontSize: font.body,
            flex: 1
          }}
        />
        {colour ? <SceneColour {...colour} /> : null}
      </View>
    </View>
  )
}

/**
 * A scene's colour in this preset, as a square of it beside the name box —
 * the colour Play draws the scene in when it is the one you are on, with the
 * word on it in the letters Play would use — and the button that opens the
 * colour sheet on it. On paper a pale one gets the
 * paper edge (lib/ink), as a swatch does, or white is a hole in the page.
 */
function SceneColour({ fill, said, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={said}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        width: TAP,
        minHeight: TAP,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: isDark() ? fill : paperEdge(fill),
        backgroundColor: fill,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1
      })}
    >
      <Text style={{ color: inkOn(fill), fontSize: font.micro, fontWeight: '600' }}>Colour</Text>
    </Pressable>
  )
}
