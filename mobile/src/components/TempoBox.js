import { useRef, useState } from 'react'
import { Modal, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { BlurView } from 'expo-blur'

import { color, font, mono, radius, space, TAP } from '../lib/theme'
import { ANY_WAY_UP } from '../lib/screenShape'
import { ANY_BPM, checkBpm } from '../lib/tempo'
import { freshField, heldSelection, selectedByHand, selectionMoved, shownText, typedInto } from '../lib/tempo-field'
import MetronomeSwitch from './MetronomeSwitch'
import Press from './Press'

const face = Platform.select(mono)

/**
 * A tempo, typed.
 *
 * "When holding tap button to manually enter tempo the keyboard blocks the
 * numbers so you can see what your typing."
 *
 * IT SITS HIGH ON PURPOSE, and that is the whole of the fix. The box was in the
 * foot of the stage screen, which is where a thumb rests and therefore exactly
 * where iOS puts the keyboard — so the moment it opened it covered the one
 * thing you had opened it to look at. A bottom sheet would have had the same
 * problem for the same reason.
 *
 * So it is an overlay in the upper part of the screen. A number pad takes
 * roughly the bottom two fifths; a third of the way down clears it on every
 * phone this runs on, and `keyboardVerticalOffset` is not a number anybody
 * should have to guess per device.
 *
 * The box is in the top three fifths, then, and it gives up the gap above
 * it before it gives up that line. With the metronome in it, the box is taller
 * than the room a small phone has between its 14% gap and the number pad — a
 * 320 by 568 screen, the first iPhone SE, which this app's iOS 15.1 floor
 * still reaches — so there the gap shrinks, down to the status bar. On a
 * taller phone nothing moves.
 *
 * What that buys, and only this: the box is the same height whatever it has
 * to say. A tempo it refuses is said in place of the range line, "The unit
 * didn't take it" in place of the metronome's line, and on a phone 640 high
 * or less the metronome's line is held to two. Measured in the demo at 320
 * by 568, 360 by 640, 375 by 667 and 440 by 956, against an iPhone's number
 * pad (216 points) and an Android's (about two fifths of the screen), with
 * the longest line the switch can say: the field, Set, the switch and
 * whichever message is showing sit above the keys on all of them. The one
 * miss is 375 by 667 with an Android's pad, a refused tempo and a five-line
 * note all at once, where the note's last line reaches the keys — and 375 by
 * 667 is an iPhone's size, whose pad starts lower. Not promised: the phone's
 * larger text sizes, which make every line taller than this was measured at.
 * The box is not clipped, so nothing is ever cut off.
 *
 * Tap gets you close and this gets you exact — "on the tap button, let's do
 * where they hold the tap button they can manually enter in the beats per
 * minute they want."
 *
 * The range is the unit's own and is said out loud rather than enforced in
 * silence: a box that refuses 500 without explaining is a box that looks
 * broken. checkBpm is shared with the browser, so both refuse the same things
 * in the same words.
 */
export default function TempoBox({ open, bpm, range = ANY_BPM, onSet, onClose }) {
  /* What is in the box and how much of it is selected: lib/tempo-field. */
  const [field, setField] = useState(freshField)
  const [error, setError] = useState(null)
  const [wasOpen, setWasOpen] = useState(false)
  const { height } = useWindowDimensions()
  const input = useRef(null)
  /*
   * A small phone: tighter spacing, and the metronome's words held to two
   * lines, so all of it fits above the keys. 640 itself is in: a 360 by 640
   * Android, whose number pad comes up about two fifths of the screen, had
   * the foot of a three-line metronome note under it.
   */
  const tight = height <= 640

  /*
   * A fresh box each time it opens, from its very first frame.
   *
   * This was an effect, and an effect runs after the frame it belongs to is
   * already on screen. The field took the keyboard empty, the number came in
   * after — and the cursor stayed behind it, which is the whole complaint.
   * Reset while rendering instead (React's own pattern for state that follows
   * a prop), so the first frame the box ever draws already holds the tempo,
   * selected. Only on opening: the fade out keeps what was there.
   */
  if (!!open !== wasOpen) {
    setWasOpen(!!open)
    if (open) {
      setField(freshField())
      setError(null)
    }
  }

  /* What is in the box: typed, or the unit's own tempo until something is. */
  const typed = shownText(field, bpm)

  const commit = async () => {
    const checked = checkBpm(typed, range)
    if (checked.error) {
      setError(checked.error)
      return
    }
    /* Nothing typed, or the tempo it is already at: close without a write. */
    if (checked.empty || checked.bpm === Math.round(bpm)) {
      onClose()
      return
    }
    try {
      await onSet(checked.bpm)
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  /*
   * Once the box is fully up. `autoFocus` puts the keyboard up while the box
   * is still fading in, which is quicker than waiting for this; this is the
   * net under it. On Android a Modal is its own window, and a field that asks
   * for the keyboard before that window has focus can be focused with no
   * keyboard — so Android always asks again here. On iPhone only a field that
   * did not get focus is focused: focusing one that has it would select
   * whatever was typed during the fade, and the next digit would wipe it.
   * And while the number is still held, it is selected once more by hand —
   * which an iPhone never reports back, so the box notes it did it: from here
   * a tap in the number is the player's, and the cursor goes where it lands.
   */
  const shown = () => {
    const f = input.current
    if (!f) return
    if (Platform.OS === 'android' || !f.isFocused?.()) f.focus()
    if (field.held && typed && f.setSelection) {
      f.setSelection(0, typed.length)
      setField(selectedByHand)
    }
  }

  return (
    <Modal visible={!!open} transparent animationType="fade" onRequestClose={onClose} onShow={shown} statusBarTranslucent supportedOrientations={ANY_WAY_UP}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }}>
        <BlurView
          intensity={70}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={{
            flex: 1,
            alignItems: 'center',
            paddingHorizontal: tight ? space.lg : space.xl
          }}
        >
          {/*
            The part of the screen the number pad never reaches: the top three
            fifths. The gap above the box is the one thing in here allowed to
            shrink, so on a short phone the box rises rather than reaching the
            keys. Visible overflow, so nothing is ever cut off if it still does.
          */}
          <View style={{ width: '100%', height: height * ABOVE_KEYS, alignItems: 'center', overflow: 'visible' }}>
            <View style={{ height: Math.max(space.xxl, height * 0.14), minHeight: space.xxl, flexShrink: 1 }} />
            <Pressable
              /* Swallows presses, so tapping the panel does not close the thing
                 you are typing into. Focuses the field only when it has lost
                 it: asking a focused field again selects all of it, and a
                 stray touch on the panel would turn "13" into the next digit. */
              onPress={() => {
                if (!input.current?.isFocused?.()) input.current?.focus()
              }}
              style={{
                width: '100%',
                maxWidth: 420,
                flexShrink: 0,
                gap: tight ? space.sm : space.md,
                padding: tight ? space.md : space.lg,
                borderRadius: radius.lg * 2,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
                backgroundColor: 'rgba(255,255,255,0.04)'
              }}
            >
              <Text style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5 }}>TEMPO</Text>

              <TextInput
                ref={input}
                autoFocus
                /* Kept for the focus asked for from the code (onShow, the
                   panel), where both phones honour it. The selection below is
                   what makes the box come up selected. */
                selectTextOnFocus
                value={typed}
                /* The whole number while it is held — see lib/tempo-field. */
                selection={heldSelection(field, typed)}
                onSelectionChange={(e) => {
                  const at = e?.nativeEvent?.selection
                  setField((f) => selectionMoved(f, at, shownText(f, bpm)))
                }}
                onChangeText={(t) => {
                  setField((f) => typedInto(f, t))
                  setError(null)
                }}
                keyboardType="number-pad"
                returnKeyType="done"
                accessibilityLabel="Tempo in beats per minute"
                placeholder="BPM"
                placeholderTextColor={color.silkFaint}
                onSubmitEditing={commit}
                style={{
                  minHeight: tight ? TAP + 8 : TAP + 24,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  borderWidth: 1,
                  borderColor: error ? color.fault : color.live,
                  borderRadius: radius.md,
                  paddingHorizontal: space.md,
                  color: color.silk,
                  fontSize: font.display,
                  fontFamily: face,
                  textAlign: 'center'
                }}
              />

              {/*
                The range, or what went wrong, in the same place.

                What went wrong was a note of its own above Cancel and Set, and
                it made the box two lines taller at the moment it appeared —
                which on a small phone put the metronome under the number pad.
                In place of the range it moves nothing: the range is what most
                of these sentences say anyway ("500 BPM is out of range — the
                unit takes 24 to 250."), in the fault colour, with the field's
                border turned the same colour above it.
              */}
              <Text
                accessibilityLiveRegion={error ? 'polite' : 'none'}
                style={{ color: error ? color.fault : color.silkDim, fontSize: font.small, textAlign: 'center' }}
              >
                {error || `${range.min} to ${range.max} beats per minute`}
              </Text>

              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Press grow label="Cancel" onPress={onClose} />
                <Press grow label="Set" tone="signal" on onPress={commit} />
              </View>

              {/*
                The metronome, on and off, under the tempo rather than above Set.

                "Also, can we add the metronome on and off to this screen as
                well so they can quickly turn the metronome on and off?" The
                volume pop-up's own switch, so it writes the unit the same way
                and says the same line about where the click is — over
                Bluetooth, on an AM4 and in the demo it explains itself here
                exactly as it does there.

                Below Cancel and Set, not between them and the number, for two
                reasons. It acts the moment it is pressed, not when Set is, and
                a switch sitting above Set reads as part of what Set sends.
                And its line changes length with where the click is (four lines
                over Bluetooth); below, that moves nothing the player is aiming
                at. A press here is its own: it does not close the box, does
                not send the tempo and does not touch what was typed.

                `compact` keeps it the same height whatever it has to say: one
                block of words under it, where the volume pop-up has two, so
                "The unit didn't take it" takes the line's place rather than
                coming in under it — and on a small phone that block is held
                to two lines, so it never reaches the keys. The whole of the
                line is in the volume pop-up and Settings → Metronome.
              */}
              <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)', paddingTop: tight ? space.sm : space.md }}>
                <MetronomeSwitch compact lines={tight ? 2 : undefined} />
              </View>
            </Pressable>
          </View>
        </BlurView>
      </Pressable>
    </Modal>
  )
}

/* How much of the screen the box stays inside: all but the bottom two fifths, where the number pad is. */
const ABOVE_KEYS = 0.6
