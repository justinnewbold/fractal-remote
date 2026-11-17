import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import Press from './Press'
import { tick } from '../lib/feedback'
import { cancelTapAlong, finishTapAlong, nudgeLineUp, setLineUp, startTapAlong, tapAlongTap, useBeatHeld, useBeatWhy, useLineUp, usePhoneClicking, useTapAlong } from '../lib/metronome'
import { LINE_UP, LINE_UP_WORDS, TAP_ALONG, lineUpWords, tapAlongHere, tapAlongWords } from '../lib/lineUp'
import { deviceNoun } from '../lib/device-word'

/** How tall the pad is: big enough to hit without looking. */
export const TAP_PAD_TALL = 160

/**
 * LINE UP THE LIGHT AND CLICK, on Settings → Metronome (lib/lineUp has the
 * why). Two nudges, the light and this device's click, each Earlier and
 * Later with where it is in his words under its name, and Reset; and Tap
 * along, where there is a click from the unit to tap to.
 *
 * Drawn only for an account it is offered to (features
 * METRONOME_LINE_UP_FOR_EVERYONE). `setting` is the metronome's setting,
 * `can` whether the unit's click can be switched from here, `quiet` the
 * sound picked Off.
 *
 * NO PAD WHILE TAP ALONG IS NOT OFFERED, a run already open included:
 * the line says why, and Cancel or Done (which then sets nothing) put it
 * away.
 *
 * THE PAD TAKES THE TOUCH AS IT LANDS (onPressIn), not as the finger lifts,
 * which is a press: how long a finger rests is not the beat.
 */
export default function LineUp({ setting = {}, can = false, quiet = false }) {
  const lined = useLineUp()
  const tapping = useTapAlong()
  const running = usePhoneClicking()
  /* Tap along only while this device's beat is held on the unit's, and if not, why (lib/lineUp tapAlongHere has why). */
  const held = useBeatHeld()
  const why = useBeatWhy()
  /* Put away with the page: a run of taps left open is not waiting on the next visit, nor its answer. */
  useEffect(() => () => cancelTapAlong(), [])
  if (!lined.offered) return null
  const noun = deviceNoun()
  const here = tapAlongHere({ on: setting.on === true, where: setting.where, can, quiet, running, held, why, noun })
  const words = { color: color.silkDim, fontSize: font.small, paddingHorizontal: space.sm }
  const row = (part, name) => (
    <View key={part} style={{ gap: space.xs }}>
      <Text style={{ color: color.silk, fontSize: font.body, paddingHorizontal: space.sm }}>{`${name}: ${lineUpWords(lined[part])}`}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Press
          label={LINE_UP_WORDS.earlier}
          grow
          disabled={lined[part] <= LINE_UP.min}
          accessibilityLabel={`${name}: ${LINE_UP_WORDS.earlier}`}
          onPress={() => nudgeLineUp(part, -LINE_UP.step)}
        />
        <Press
          label={LINE_UP_WORDS.later}
          grow
          disabled={lined[part] >= LINE_UP.max}
          accessibilityLabel={`${name}: ${LINE_UP_WORDS.later}`}
          onPress={() => nudgeLineUp(part, LINE_UP.step)}
        />
      </View>
    </View>
  )

  return (
    <View style={{ gap: space.md }}>
      <Text accessibilityRole="header" style={{ color: color.silkFaint, fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }}>
        {LINE_UP_WORDS.section}
      </Text>
      <Text style={words}>{LINE_UP_WORDS.hint(noun)}</Text>
      {row('light', LINE_UP_WORDS.light)}
      {row('click', LINE_UP_WORDS.click(noun))}
      {lined.light !== 0 || lined.click !== 0 ? <Press label={LINE_UP_WORDS.reset} onPress={() => setLineUp({ light: 0, click: 0 })} /> : null}
      {tapping.open ? (
        <View style={{ gap: space.sm }}>
          <Text style={words}>{here.offered ? LINE_UP_WORDS.tapHow : here.why}</Text>
          {here.offered ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={LINE_UP_WORDS.pad}
              onPressIn={() => {
                tapAlongTap()
                tick()
              }}
              style={({ pressed }) => ({
                minHeight: TAP_PAD_TALL,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: color.live,
                backgroundColor: color.panel,
                opacity: pressed ? 0.7 : 1
              })}
            >
              <Text style={{ color: color.silk, fontSize: font.body }}>{LINE_UP_WORDS.pad}</Text>
              <Text style={{ color: color.silkDim, fontSize: font.small }}>{LINE_UP_WORDS.taps(tapping.offsets.length)}</Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Press label={LINE_UP_WORDS.cancel} grow onPress={cancelTapAlong} />
            <Press label={LINE_UP_WORDS.done} tone="live" grow disabled={tapping.offsets.length < TAP_ALONG.least} onPress={finishTapAlong} />
          </View>
        </View>
      ) : (
        <>
          {here.offered ? <Press label={LINE_UP_WORDS.tap} tone="live" onPress={startTapAlong} /> : <Text style={words}>{here.why}</Text>}
          {tapping.said ? (
            <Text accessibilityLiveRegion="polite" style={words}>
              {tapAlongWords(tapping.said, noun)}
            </Text>
          ) : null}
        </>
      )}
    </View>
  )
}
