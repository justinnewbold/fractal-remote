import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { color, font, radius, space, TAP } from '../lib/theme'
import { tick } from '../lib/feedback'
import { deviceNoun } from '../lib/device-word'
import { sync, useStored } from '../lib/store'
import {
  COUNTS,
  HOW_MANY,
  SOURCES,
  SOURCE_EMPTY,
  SOURCE_WORDS,
  TILES_SHOW,
  VIEW_BUTTON,
  VIEW_HINT,
  VIEW_NOTE,
  VIEW_TITLE,
  VIEW_WORDS,
  loadCount,
  loadSource,
  loadView,
  saveCount,
  saveSource,
  saveView,
  showsPedals,
  showsPresets,
  showsScenes,
  viewsFor
} from '../lib/playView'
import { usePlayPosture } from '../lib/usePlayViews'
import { GlassDisc } from './Glass'
import Sheet from './Sheet'

/*
 * THE VIEW BUTTON, AND ITS SHEET (lib/playView).
 *
 * "Instead of it saying view, I would like it just to be a little round icon
 * in between the volume and the settings. That's the same size." (Justin, 23
 * November 2026.) So: the speaker's own round of glass with a small picture
 * of a screen in three parts on it, drawn here from three boxes so it needs
 * no picture file and takes the bar's ink.
 *
 * A tap opens pictures to pick from, one for each view this way of holding
 * the device is offered, and under them which presets the tiles show and how
 * many. Play changes behind the sheet as each is tapped: every choice is
 * written to the device's storage, which Play redraws on.
 */
const BOX = 24

function Glyph({ ink }) {
  const bar = { backgroundColor: ink, borderRadius: 1.5 }
  return (
    <View accessible={false} style={{ width: BOX, height: BOX, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 16, height: 16, gap: 2 }}>
        <View style={[bar, { height: 4 }]} />
        <View style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
          <View style={[bar, { flex: 1 }]} />
          <View style={[bar, { flex: 1 }]} />
        </View>
      </View>
    </View>
  )
}

/* The parts of Play in each view's picture: presets amber, scenes the live blue, pedals the Bluetooth blue. */
const PART = { presets: () => color.signal, scenes: () => color.live, pedals: () => color.ble }
function Picture({ view }) {
  const parts = [showsPresets(view) ? ['presets', view === 'top' ? 1 : view === 'both' ? 2 : 3] : null, showsScenes(view) ? ['scenes', view === 'both' ? 2 : 3] : null, showsPedals(view) ? ['pedals', 2] : null].filter(Boolean)
  return (
    <View accessible={false} style={{ height: 56, alignSelf: 'stretch', gap: 3 }}>
      {parts.map(([part, flex]) => (
        <View key={part} style={{ flex, borderRadius: 3, backgroundColor: PART[part]() }} />
      ))}
    </View>
  )
}

function Pick({ on, label, onPress, children, grow = true }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={() => {
        tick()
        onPress()
      }}
      style={({ pressed }) => ({
        flex: grow ? 1 : undefined,
        minHeight: TAP,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        paddingHorizontal: space.xs,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        borderWidth: on ? 1.5 : 1,
        borderColor: on ? color.signal : color.rule,
        backgroundColor: pressed ? color.panelHi : color.panel
      })}
    >
      {children}
      <Text style={{ color: on ? color.signal : color.silk, fontSize: font.micro, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  )
}

const HEADING = { fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }
const ROW = { flexDirection: 'row', gap: space.sm }

export default function PlayViewButton() {
  const [open, setOpen] = useState(false)
  useStored()
  const { posture, fell } = usePlayPosture()
  const view = loadView(sync, posture)
  const source = loadSource(sync)
  const count = loadCount(sync)
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={VIEW_BUTTON} accessibilityHint={VIEW_HINT} hitSlop={10} onPress={() => setOpen(true)}>
        {/* The speaker's own round of glass (components/Glass), taking no room and no touch. */}
        <GlassDisc size={30} box={BOX} />
        <Glyph ink={color.silkDim} />
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} title={VIEW_TITLE} note={VIEW_NOTE(deviceNoun())}>
        <View style={{ gap: space.md }}>
          <View style={ROW}>
            {viewsFor(posture).map((v) => (
              <Pick key={v} on={v === view} label={VIEW_WORDS[v]} onPress={() => saveView(v, posture, sync)}>
                <Picture view={v} />
              </Pick>
            ))}
          </View>
          {showsPresets(view) ? (
            <>
              <Text style={[HEADING, { color: color.silkFaint }]}>{TILES_SHOW}</Text>
              <View style={ROW}>
                {SOURCES.map((s) => (
                  <Pick key={s} on={s === source} label={SOURCE_WORDS[s]} onPress={() => saveSource(s, sync)} />
                ))}
              </View>
              {fell && SOURCE_EMPTY[source] ? <Text style={{ color: color.silkDim, fontSize: font.small }}>{SOURCE_EMPTY[source]}</Text> : null}
              <Text style={[HEADING, { color: color.silkFaint }]}>{HOW_MANY}</Text>
              <View style={ROW}>
                {COUNTS.map((c) => (
                  <Pick key={c} on={c === count} label={String(c)} onPress={() => saveCount(c, sync)} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      </Sheet>
    </>
  )
}
