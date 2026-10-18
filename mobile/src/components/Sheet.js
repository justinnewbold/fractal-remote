import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { color, font, radius, space } from '../lib/theme'

/* Above a tall sheet: the status bar — this much where the phone does not say — and a strip of glass. */
const STATUS_AT_LEAST = 20
const GLASS = 8

/**
 * Something that comes up over the screen rather than into it.
 *
 * "When holding a block to change channel have it be an overlay on the screen
 * instead of inserting itself into the screen like the web version."
 *
 * WHY INSERTING IS WORSE THAN IT SOUNDS, and it is not only a matter of taste.
 * A panel that opens inside a scrolling page pushes everything below it down —
 * so the tiles a thumb was aimed at move while the thumb is on its way, and on
 * the one screen where that happens mid-song. The browser learned this and made
 * every one of these a sheet; the phone had the panel version of the same idea.
 *
 * A sheet comes up from the bottom because that is where a thumb is, and it
 * covers the page rather than resizing it, so nothing underneath moves at all.
 *
 * THE BACKDROP CLOSES IT AND THE PANEL DOES NOT. A press that lands on the sheet
 * is a press on the sheet, including one that started as a slip off a control.
 * Only the glass around it is a way out.
 *
 * `foot` is what stays at the bottom however far the rest scrolls: the
 * colour sheet's Cancel and Use it, and the big Put back and Keep mine of
 * the Colours page's confirm. "Built for one thumb": the buttons that finish
 * the errand sit where the thumb already is, never scrolled off the bottom
 * of a small phone by the grid above them.
 *
 * `head` is the other half of that: what stays at the top, under the title,
 * while only the rest scrolls between it and the foot — the colour sheet's
 * tiles, Lighter and Darker, over a grid of swatches that scrolls on its own.
 * And `tall` lets a sheet like that come up to just under the status bar,
 * rather than four fifths of the screen: on a 568-point phone four fifths
 * left the colour sheet no room for a single row of colours between its head
 * and its foot. Under the status bar and never into it, by the phone's own
 * measure of it, so a tall sheet on a phone with an island keeps its title
 * clear of the clock. Every other sheet keeps the four fifths.
 */
export default function Sheet({ open, onClose, title, note, head, foot, tall = false, children }) {
  const { height } = useWindowDimensions()
  const { top } = useSafeAreaInsets()
  /* Tall: everything but the status bar and a strip of glass to tap out on. */
  const highest = tall ? Math.max(height * 0.8, height - Math.max(top, STATUS_AT_LEAST) - GLASS) : height * 0.8

  return (
    <Modal visible={!!open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* The glass, and the way out. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Close ${title || 'this'}`}
        onPress={onClose}
        style={{ flex: 1 }}
      >
        <BlurView
          intensity={60}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Pressable
            /* Swallows presses so the sheet does not close under the thing you
               are reaching for. */
            onPress={() => {}}
            style={{
              maxHeight: highest,
              backgroundColor: color.chassis,
              borderTopLeftRadius: radius.lg * 2,
              borderTopRightRadius: radius.lg * 2,
              borderTopWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              paddingBottom: space.xxl
            }}
          >
            {/* The grab handle. It does not drag — it says which way this came
                from and which way it goes, which is most of what it is for. */}
            <View style={{ alignItems: 'center', paddingTop: space.sm, paddingBottom: space.xs }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: color.rule }} />
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: space.md,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                borderBottomWidth: 1,
                borderBottomColor: color.rule
              }}
            >
              <View style={{ flexShrink: 1 }}>
                <Text
                  accessibilityRole="header"
                  numberOfLines={1}
                  style={{ color: color.silk, fontSize: font.title, fontWeight: '700' }}
                >
                  {title}
                </Text>
                {note ? (
                  <Text style={{ color: color.silkDim, fontSize: font.small }}>{note}</Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={({ pressed }) => ({
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? color.panelHi : color.panel
                })}
              >
                <Text style={{ color: color.silkDim, fontSize: font.lead }}>✕</Text>
              </Pressable>
            </View>

            {head ? <View style={{ gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm }}>{head}</View> : null}
            <ScrollView
              contentContainerStyle={{ padding: space.lg, paddingTop: head ? space.sm : space.lg, gap: space.md }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {foot ? <View style={{ gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm }}>{foot}</View> : null}
          </Pressable>
        </BlurView>
      </Pressable>
    </Modal>
  )
}
