import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Animated, View } from 'react-native'

import { color, radius, space, TAP } from '../lib/theme'
import { WHEEL_REST_MS, WHEEL_ROW, WHEEL_SLOT, clickDue, wheelAround, wheelCentre, wheelCurve, wheelOffset, wheelPad } from '../lib/presetWheel'
import { closeWheelClick, openWheelClick, wheelClick } from '../lib/wheelClick'

/**
 * ALL PRESETS AS A WHEEL (lib/presetWheel has the why and the arithmetic).
 *
 * The rows are the list's own rows, drawn by screens/Presets exactly as it
 * draws them for the list, only taller: this component decides where each
 * one sits and how big and bright it is, from how far it is from the middle
 * of the room, and nothing else. A tap, a hold and the star all go where
 * they go in the list, and NOTHING LOADS UNTIL A ROW IS TAPPED.
 *
 * HOW IT IS LAID OUT. Every row has one slot of the scroll (WHEEL_SLOT), and
 * the space over the first and under the last is half the room, so row i is
 * in the middle when the list has scrolled i slots: a whole number, which is
 * what lets the list stop on a row (snapToInterval) and lets "go to row i"
 * be one multiplication. The sizes and the closing-up are transforms driven
 * straight from the scroll, so they keep up with a thumb without waiting for
 * a render.
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
          /* Rows drawn small sit closer than they are laid out, so more of them are on screen than the list would guess. */
          windowSize={11}
          getItemLayout={(_, i) => ({ length: WHEEL_SLOT, offset: WHEEL_SLOT * i, index: i })}
          initialScrollIndex={count ? first : undefined}
          onScrollToIndexFailed={() => {
            /* Only while the list is still measuring: it stays where it is. */
          }}
          /*
           * A row drawn away from where it is laid out still has to be seen
           * and pressed there. Android's list takes rows out of the screen
           * by where they are LAID OUT, which would take out the small rows
           * drawn in from beyond the edges; and a row's cell, left as a
           * target of its own, would swallow a press meant for the row drawn
           * over it from the next slot (Cell, below).
           */
          removeClippedSubviews={false}
          CellRendererComponent={Cell}
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
    </View>
  )
}

/**
 * A row's place in the list, which is never itself what a finger lands on:
 * only the row drawn in it, or over it, is.
 */
function Cell({ style, onLayout, children }) {
  return (
    <View style={style} onLayout={onLayout} pointerEvents="box-none">
      {children}
    </View>
  )
}

/**
 * One row of the wheel: its slot of the scroll, and the three things the
 * scroll tells it (how big, how bright, how far toward the middle), with a
 * bright edge that comes up as it reaches the middle and goes as it leaves.
 */
function WheelRow({ y, index, children }) {
  const drawn = useMemo(() => {
    const curve = wheelCurve(index)
    const at = wheelOffset(index)
    return {
      scale: y.interpolate({ inputRange: curve.input, outputRange: curve.scale, extrapolate: 'clamp' }),
      opacity: y.interpolate({ inputRange: curve.input, outputRange: curve.opacity, extrapolate: 'clamp' }),
      /* Carried on past the last step at its rate, so rows further out stay evenly spaced. */
      shift: y.interpolate({ inputRange: curve.input, outputRange: curve.shift, extrapolate: 'extend' }),
      lit: y.interpolate({ inputRange: [at - WHEEL_SLOT / 2, at, at + WHEEL_SLOT / 2], outputRange: [0, 1, 0], extrapolate: 'clamp' })
    }
  }, [y, index])
  return (
    <Animated.View pointerEvents="box-none" style={{ height: WHEEL_SLOT, justifyContent: 'center', opacity: drawn.opacity, transform: [{ translateY: drawn.shift }, { scale: drawn.scale }] }}>
      {children}
      {/* The middle row's bright edge, over the preset's button and not its star. Never in the way of a press. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: TAP + space.sm,
          top: (WHEEL_SLOT - WHEEL_ROW) / 2,
          height: WHEEL_ROW,
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: color.silk,
          opacity: drawn.lit
        }}
      />
    </Animated.View>
  )
}
