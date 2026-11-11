import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Animated, Platform, Pressable, Text, View } from 'react-native'

import { color, font, mono, space } from '../lib/theme'
import { WHEEL_NAME, WHEEL_REST_MS, WHEEL_ROW, WHEEL_SLOT, clickDue, wheelAround, wheelCentre, wheelCurve, wheelOffset, wheelPad } from '../lib/presetWheel'
import { closeWheelClick, openWheelClick, wheelClick } from '../lib/wheelClick'
import { thud, tick } from '../lib/feedback'
import { fire, said } from '../lib/tapped'

const face = Platform.select(mono)

/* How wide the star's place is at the end of a row, and the colour tag's at its start: a thumb's 44, so the name between them is in the middle of the screen. */
const WHEEL_END = 44

/**
 * ALL PRESETS AS A WHEEL (lib/presetWheel has the why and the arithmetic).
 *
 * The rows are names with no box round them (WheelPreset, below, handed
 * what screens/Presets hands its list's rows): this component decides how
 * big and bright each one is, from how far it is from the middle of the
 * room, and nothing else. A tap, a hold and the star all go where they go
 * in the list, and NOTHING LOADS UNTIL A ROW IS TAPPED.
 *
 * HOW IT IS LAID OUT. Every row has one slot of the scroll (WHEEL_SLOT), and
 * the space over the first and under the last is half the room, so row i is
 * in the middle when the list has scrolled i slots: a whole number, which is
 * what lets the list stop on a row (snapToInterval) and lets "go to row i"
 * be one multiplication. A ROW IS NEVER MOVED from where the scroll puts it,
 * so it follows a thumb exactly; only its size and brightness change, as
 * transforms driven straight from the scroll, so they keep up without
 * waiting for a render. Two faint lines mark the middle slot, and a name
 * crossing one is the click.
 *
 * `listRef` is given the two things the screen asks of its list: toRow(i)
 * and toTop().
 */
export default function PresetWheel({ listRef, data, row, startAt = 0, clicks = true, onAround, footer = null, empty = null }) {
  /* How tall the list's own room is. Nothing is drawn until it is known: the space over the first row is half of it. */
  const [room, setRoom] = useState(0)
  const pad = wheelPad(room)
  const list = useRef(null)
  const count = data.length
  const first = Math.min(Math.max(0, startAt), Math.max(0, count - 1))
  const y = useRef(new Animated.Value(wheelOffset(first))).current

  useImperativeHandle(
    listRef,
    () => ({
      toRow: (index, animated = false) => {
        try {
          list.current?.scrollToOffset({ offset: wheelOffset(index), animated })
        } catch {
          /* Only while the list is still measuring; the next ask works. */
        }
      },
      toTop: () => {
        try {
          list.current?.scrollToOffset({ offset: 0, animated: false })
        } catch {
          /* The same. */
        }
      }
    }),
    []
  )

  /* The sound's players live as long as a wheel that clicks is on screen. */
  useEffect(() => {
    if (!clicks) return undefined
    openWheelClick()
    return closeWheelClick
  }, [clicks])

  /*
   * WHICH ROW IS IN THE MIDDLE, kept as the scroll moves. A change is a
   * click, but only under a thumb or the flick it leaves behind (`moving`):
   * the list jumping to the preset being played when it opens, or back to
   * the top of a search, is not somebody turning the wheel.
   *
   * A thumb that stops on the glass and then carries on is still one drag
   * (`dragging`), and the list says it began only once: so the wheel is
   * moving for as long as the thumb is down, however still it holds, and
   * after it lifts until the flick has run out.
   *
   * And the names around the middle are asked for once the wheel rests,
   * never during a flick: each name is a read of the unit (lib/presetNames).
   */
  const centre = useRef(first)
  const moving = useRef(false)
  const dragging = useRef(false)
  const lastClick = useRef(0)
  const rest = useRef(null)
  const around = useRef(onAround)
  around.current = onAround
  const counted = useRef(count)
  counted.current = count
  const clicking = useRef(clicks)
  clicking.current = clicks

  const settle = useCallback(() => {
    clearTimeout(rest.current)
    rest.current = setTimeout(() => {
      if (!dragging.current) moving.current = false
      around.current?.(wheelAround(centre.current, counted.current))
    }, WHEEL_REST_MS)
  }, [])
  useEffect(() => () => clearTimeout(rest.current), [])

  const scrolled = useCallback(
    (e) => {
      const at = wheelCentre(e.nativeEvent.contentOffset.y, counted.current)
      settle()
      if (at === centre.current) return
      centre.current = at
      if (!moving.current || !clicking.current) return
      const now = Date.now()
      if (!clickDue(now, lastClick.current)) return
      lastClick.current = now
      wheelClick()
    },
    [settle]
  )
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: true, listener: scrolled }),
    [y, scrolled]
  )

  /* Once the room is known: exactly on the row it opened for, and its neighbours' names asked for. */
  const placed = useRef(false)
  useEffect(() => {
    if (!room || placed.current) return undefined
    placed.current = true
    const id = requestAnimationFrame(() => {
      try {
        list.current?.scrollToOffset({ offset: wheelOffset(first), animated: false })
      } catch {
        /* A list that will not go there shows its top, as the list used to. */
      }
      around.current?.(wheelAround(first, counted.current))
    })
    return () => cancelAnimationFrame(id)
  }, [room, first])

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setRoom(e.nativeEvent.layout.height)}>
      {room ? (
        <Animated.FlatList
          ref={list}
          data={data}
          keyExtractor={(n) => String(n)}
          /* Half the room over the first row and under the last, so each can reach the middle. The list's own offsets do not count this space, which is what puts row i in the middle at i slots. */
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: pad, paddingBottom: pad }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={20}
          windowSize={7}
          getItemLayout={(_, i) => ({ length: WHEEL_SLOT, offset: WHEEL_SLOT * i, index: i })}
          initialScrollIndex={count ? first : undefined}
          onScrollToIndexFailed={() => {
            /* Only while the list is still measuring: it stays where it is. */
          }}
          /* It stops on a row, like the wheel it is named for. */
          snapToInterval={WHEEL_SLOT}
          decelerationRate="normal"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onScrollBeginDrag={() => {
            dragging.current = true
            moving.current = true
          }}
          onScrollEndDrag={() => {
            /* The thumb is up: moving until the flick runs out, or at once if there is none. */
            dragging.current = false
            settle()
          }}
          renderItem={({ item, index }) => (
            <WheelRow y={y} index={index}>
              {row(item)}
            </WheelRow>
          )}
          ListEmptyComponent={empty}
          ListFooterComponent={footer}
        />
      ) : null}
      {/* The middle slot, marked by a faint line over it and one under it. They stay put while the names go by, and are never in the way of a press. */}
      {room && count ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: space.lg, right: space.lg, top: room / 2 - WHEEL_SLOT / 2, height: WHEEL_SLOT, borderTopWidth: 1, borderBottomWidth: 1, borderColor: color.rule }} />
      ) : null}
    </View>
  )
}

/**
 * One row of the wheel: its slot of the scroll, and the two things the
 * scroll tells it, how big and how bright. Never where it is.
 */
function WheelRow({ y, index, children }) {
  const drawn = useMemo(() => {
    const curve = wheelCurve(index)
    return {
      scale: y.interpolate({ inputRange: curve.input, outputRange: curve.scale, extrapolate: 'clamp' }),
      opacity: y.interpolate({ inputRange: curve.input, outputRange: curve.opacity, extrapolate: 'clamp' })
    }
  }, [y, index])
  return <Animated.View style={{ height: WHEEL_SLOT, justifyContent: 'center', opacity: drawn.opacity, transform: [{ scale: drawn.scale }] }}>{children}</Animated.View>
}

/**
 * A PRESET ON THE WHEEL: its name and its slot, with no box round them.
 *
 * "We probably want to remove the boxes around the outside edge of the
 * presets as well and make the size of the preset names a little smaller"
 * (Justin, 11 November 2026). So it is two lines of type: the name
 * (WHEEL_NAME, drawn smaller only when it would not fit) and the slot under
 * it. The one being played is amber and says "Playing", as its row in the
 * list does; a colour tag is a short bar before the name; the star is the
 * star alone, on a thumb's worth of its own at the end, away from the part
 * that loads the preset.
 *
 * It does what the list's row does and nothing of its own: screens/Presets
 * hands it the same press, hold and star it hands the list's.
 */
export function WheelPreset({ label, sub, here = false, bar = null, starred = false, starLabel, hint, onPress, onLongPress, onStar }) {
  const ink = here ? color.signal : color.silk
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: WHEEL_ROW }}>
      <View style={{ width: WHEEL_END, alignItems: 'center' }}>
        {bar ? <View style={{ width: 4, height: WHEEL_ROW - 22, borderRadius: 2, backgroundColor: bar }} /> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: here }}
        accessibilityLabel={[label, sub].filter(Boolean).join(', ')}
        accessibilityHint={hint}
        onPress={() => {
          thud()
          fire(`press ${said(label)}`, onPress)
        }}
        onLongPress={
          onLongPress
            ? () => {
                thud()
                fire(`hold ${said(label)}`, onLongPress)
              }
            : undefined
        }
        delayLongPress={450}
        style={({ pressed }) => ({ flex: 1, height: WHEEL_ROW, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: ink, fontSize: WHEEL_NAME, fontWeight: '700', textAlign: 'center' }}>
          {label}
        </Text>
        <Text numberOfLines={1} style={{ color: here ? color.signal : color.silkDim, fontSize: font.micro, fontFamily: face, textAlign: 'center', marginTop: 1 }}>
          {sub}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: starred }}
        accessibilityLabel={starLabel}
        onPress={() => {
          tick()
          onStar?.()
        }}
        style={({ pressed }) => ({ width: WHEEL_END, height: WHEEL_ROW, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ color: starred ? color.signal : color.silkFaint, fontSize: font.lead + 2, fontFamily: face }}>{starred ? '★' : '☆'}</Text>
      </Pressable>
    </View>
  )
}
