import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'

import { color, font, mono, radius, space } from '../lib/theme'
import { tileWidth } from '../lib/tileGrid'
import { thud } from '../lib/feedback'
import { tagEdge } from './PresetTag'

/*
 * PRESET TILES ON PLAY (lib/playView): one tap loads a preset, as a scene
 * tile is one tap. Each says its slot as the unit counts it and its name
 * where the app already knows it (never asked for from here: Play is not a
 * reason to read a preset off the unit mid-song), wears its colour tag down
 * its left edge as its row in All presets does, and the one the unit is on
 * is lit.
 *
 * Play says which presets, how many to a row and how tall; this draws them
 * and tells Play how tall the block came out (`onGrid`).
 *
 * THE WIDTH IS THE BLOCK'S OWN, MEASURED HERE. Play's `row` is the row its
 * scene tiles share, which on an opened fold or a tablet is one LANE (half
 * the screen, beside the chain), while this block runs across both: sized
 * from it, eight tiles came out half as wide as they should and filled half
 * the row (a Pixel Fold, 24 November 2026). `row` is only the first frame's
 * guess, until the block has been laid out.
 */
const HEAD = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
const FACE = Platform.select(mono)
const WORD = { fontSize: font.micro, letterSpacing: 1.5, textTransform: 'uppercase' }

export default function PresetTiles({ numbers, current, cols, tall, row, said, labelOf, nameOf, tagOf, onPick, onGrid, dimmed = false }) {
  const [own, setOwn] = useState(0)
  const wide = tileWidth(own || row, cols, space.sm)
  /* Two lines of name where the tile has the height for them under its slot. */
  const lines = tall >= 60 ? 2 : 1
  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        if (w > 0 && Math.abs(w - own) >= 0.5) setOwn(w)
      }}
      style={{ gap: space.sm, alignSelf: 'stretch' }}
    >
      <View style={HEAD}>
        <Text accessibilityRole="header" style={[WORD, { color: color.silkFaint }]}>
          Presets
        </Text>
        {said ? <Text style={[WORD, { color: color.silkDim }]}>{said}</Text> : null}
      </View>
      <View onLayout={(e) => onGrid?.(e.nativeEvent.layout.height)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {numbers.map((n) => {
          const on = n === current
          const name = nameOf(n)
          const slot = labelOf(n)
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={name ? `Preset ${slot}, ${name}` : `Preset ${slot}`}
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (on) return
                thud()
                onPick(n)
              }}
              style={({ pressed }) => ({
                width: wide,
                flexGrow: wide ? 0 : 1,
                height: tall,
                justifyContent: 'center',
                paddingHorizontal: space.sm,
                borderRadius: radius.md,
                borderWidth: on ? 1.5 : 1,
                borderColor: on ? color.signal : color.rule,
                backgroundColor: on ? color.signalWash : pressed ? color.panelHi : color.panel,
                opacity: dimmed ? 0.5 : 1,
                ...tagEdge(tagOf(n))
              })}
            >
              <Text numberOfLines={1} style={{ color: on ? color.signal : color.silkDim, fontSize: font.micro, fontFamily: FACE }}>
                {slot}
              </Text>
              <Text numberOfLines={lines} style={{ color: on ? color.signal : color.silk, fontSize: font.small, fontWeight: '700' }}>
                {name || '…'}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
