import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, Platform, Pressable, Text, View } from 'react-native'

import { color, font, mono, space } from '../lib/theme'
import {
  WHEEL_GAP,
  WHEEL_NAME,
  WHEEL_NAME_ROUND,
  WHEEL_REST_MS,
  WHEEL_ROW,
  clickDue,
  onWheelRing,
  wheelAngle,
  wheelAround,
  wheelDrag,
  wheelLayout,
  wheelMove,
  wheelSpin,
  wheelSpinStart,
  wheelWindow
} from '../lib/presetWheel'
import { closeWheelClick, openWheelClick, wheelClick } from '../lib/wheelClick'
import { thud, tick } from '../lib/feedback'
import { fire, said } from '../lib/tapped'

const face = Platform.select(mono)

/* How wide the star's place is at the end of a row: a thumb's 44. */
const WHEEL_END = 44
/* What the middle button says. */
export const WHEEL_LOAD = 'Load'

/**
 * ALL PRESETS ON A CLICK WHEEL (lib/presetWheel has the why and the
 * arithmetic).
 *
 * A ring to run a thumb round, a short list over it with a bar on its
 * middle row, and a button in the middle of the ring. A notch of the ring
 * moves the bar one preset, and the bar moving, the click and the tap are
 * one step of this file's own code (`step`): nothing here scrolls, and
 * nothing coasts, so a click cannot be late. NOTHING LOADS UNTIL THE MIDDLE
 * BUTTON OR A ROW IS PRESSED, and both do what screens/Presets hands the
 * row: this file draws and counts notches, and never loads, stars or saves.
 *
 * `row(item)` answers what a preset's row says and does (the list's own
 * words, press, hold and star). `listRef` is given the two things the
 * screen asks of its list: toRow(i) and toTop().
 */
export default function PresetWheel({ listRef, data, row, startAt = 0, clicks = true, onAround, footer = null, empty = null }) {
  const count = data.length
  const [at, setAt] = useState(() => wheelMove(startAt, 0, count))
  /* The bar as the code knows it this instant: a notch is worked out from it, not from what was last drawn. */
  const where = useRef(at)
  const counted = useRef(count)
  counted.current = count
  const clicking = useRef(clicks)
  clicking.current = clicks
  const around = useRef(onAround)
  around.current = onAround

  /* How big the room is, and so how big the ring and how many rows. Nothing is drawn until it is known. */
  const [box, setBox] = useState({ w: 0, h: 0 })
  const plan = useMemo(() => wheelLayout(box.w, box.h), [box.w, box.h])

  /* The names around the bar are asked for once the wheel rests, never during a spin: each name is a read of the unit (lib/presetNames). */
  const rest = useRef(null)
  const settle = useCallback(() => {
    clearTimeout(rest.current)
    rest.current = setTimeout(() => around.current?.(wheelAround(where.current, counted.current)), WHEEL_REST_MS)
  }, [])
  useEffect(() => () => clearTimeout(rest.current), [])

  /* The bar to a row outright: opening, a jump, a search. No click: nobody turned the wheel. */
  const go = useCallback(
    (index) => {
      const next = wheelMove(index, 0, counted.current)
      where.current = next
      setAt(next)
      settle()
    },
    [settle]
  )
  useImperativeHandle(listRef, () => ({ toRow: (index) => go(index), toTop: () => go(0) }), [go])

  /* A list whose presets arrive after the wheel does opens on the row it was asked for; one that has shrunk under the bar (a search) keeps the bar on a row it has. */
  const placed = useRef(count > 0)
  const first = useRef(startAt)
  first.current = startAt
  useEffect(() => {
    if (!count) return
    if (!placed.current) {
      placed.current = true
      go(first.current)
    } else if (where.current > count - 1 || where.current < 0) go(where.current < 0 ? 0 : count - 1)
  }, [count, go])
  useEffect(() => {
    settle()
  }, [settle])

  /* The sound's players live as long as a wheel that clicks is on screen. */
  useEffect(() => {
    if (!clicks) return undefined
    openWheelClick()
    return closeWheelClick
  }, [clicks])

  /*
   * ONE STEP: the bar moves, and the click and the tap go with it, here and
   * nowhere else. At either end of the list the bar does not move, and a
   * wheel that moved nothing does not click.
   */
  const lastClick = useRef(0)
  const step = useCallback(
    (moves) => {
      const next = wheelMove(where.current, moves, counted.current)
      if (next === where.current || next < 0) return
      where.current = next
      setAt(next)
      const now = Date.now()
      if (clicking.current && clickDue(now, lastClick.current)) {
        lastClick.current = now
        wheelClick()
      }
      settle()
    },
    [settle]
  )

  /*
   * THE RING. Where the thumb is round the middle is read from the touch
   * itself: the first touch says where on the ring it landed, and so where
   * the ring's middle is on the page, and every move after is measured
   * from there. (Nothing inside the ring takes a touch, so the ring is
   * what the first touch lands on; the middle button is over it, not in
   * it.) A thumb that wanders off the ring keeps turning it until it lifts.
   */
  const spin = useRef(null)
  const middle = useRef({ x: 0, y: 0 })
  const size = useRef(plan)
  size.current = plan
  const [turning, setTurning] = useState(false)
  const dot = useRef(new Animated.Value(0)).current
  const ring = useMemo(() => {
    const onRing = (e) => {
      const { ring: d, inner } = size.current
      return onWheelRing(e.nativeEvent.locationX - d / 2, e.nativeEvent.locationY - d / 2, d / 2, inner)
    }
    const angleOf = (e) => wheelAngle(e.nativeEvent.pageX - middle.current.x, e.nativeEvent.pageY - middle.current.y)
    return PanResponder.create({
      onStartShouldSetPanResponder: onRing,
      onPanResponderGrant: (e) => {
        const d = size.current.ring
        middle.current = { x: e.nativeEvent.pageX - e.nativeEvent.locationX + d / 2, y: e.nativeEvent.pageY - e.nativeEvent.locationY + d / 2 }
        const angle = angleOf(e)
        spin.current = wheelSpinStart(angle, Date.now())
        dot.setValue(angle)
        setTurning(true)
      },
      onPanResponderMove: (e) => {
        /* Too near the middle to say which way round: the angle there swings with a hair of movement. */
        if (Math.hypot(e.nativeEvent.pageX - middle.current.x, e.nativeEvent.pageY - middle.current.y) < size.current.inner * 0.6) return
        const angle = angleOf(e)
        const turned = wheelSpin(spin.current, angle, Date.now())
        spin.current = turned.state
        dot.setValue(angle)
        if (turned.moves) step(turned.moves)
      },
      onPanResponderRelease: () => setTurning(false),
      onPanResponderTerminate: () => setTurning(false),
      /* Nothing takes the wheel from a thumb that is turning it. */
      onPanResponderTerminationRequest: () => false
    })
  }, [dot, step])

  /* THE ROWS, DRAGGED: a row of thumb for a row of list, with the same step and no coasting. A tap is still the row's own. */
  const pull = useRef({ carry: 0, last: 0 })
  const rows = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          pull.current = { carry: 0, last: 0 }
        },
        onPanResponderMove: (_, g) => {
          const moved = wheelDrag(pull.current.carry, g.dy - pull.current.last)
          pull.current = { carry: moved.carry, last: g.dy }
          if (moved.moves) step(moved.moves)
        }
      }),
    [step]
  )

  const shown = wheelWindow(at, plan.rows, count)
  const under = at >= 0 && at < count ? row(data[at]) : null
  const d = plan.ring
  const knob = Math.round(plan.inner * 2)

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {!box.h ? null : !count ? (
        <View style={{ paddingHorizontal: space.lg }}>{empty}</View>
      ) : (
        <>
          <View {...rows.panHandlers} style={{ height: plan.rows * WHEEL_ROW, paddingHorizontal: space.lg, overflow: 'hidden' }}>
            {shown.map((index, k) =>
              index === null ? (
                <View key={`blank-${k}`} style={{ height: WHEEL_ROW }} />
              ) : (
                <WheelPreset key={String(data[index])} {...row(data[index])} under={k === plan.middle} />
              )
            )}
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: WHEEL_GAP }}>
            <View style={{ width: d, height: d }}>
              <View
                {...ring.panHandlers}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Preset wheel"
                accessibilityValue={{ text: under ? [under.label, under.sub].filter(Boolean).join(', ') : '' }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
                style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: color.panelHi, borderWidth: 1, borderColor: color.rule }}
              >
                {/* Where the thumb is on the ring, while it is: a spot that goes round with it. Never in the way of the touch. */}
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: d,
                    height: d,
                    opacity: turning ? 1 : 0,
                    transform: [{ rotate: dot.interpolate({ inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] }) }]
                  }}
                >
                  <View style={{ position: 'absolute', right: (d / 2 - plan.inner) / 2 - 14, top: d / 2 - 14, width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: color.signal, backgroundColor: color.signalWash }} />
                </Animated.View>
              </View>
              {/* The middle button: it loads the preset under the bar, by that row's own press. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={under ? `${WHEEL_LOAD} ${under.label}` : WHEEL_LOAD}
                disabled={!under}
                onPress={() => {
                  thud()
                  fire(`press ${said(WHEEL_LOAD, under?.label)}`, under?.onPress)
                }}
                style={({ pressed }) => ({
                  position: 'absolute',
                  left: d / 2 - knob / 2,
                  top: d / 2 - knob / 2,
                  width: knob,
                  height: knob,
                  borderRadius: knob / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? color.panel : color.chassis,
                  borderWidth: 1,
                  borderColor: color.rule
                })}
              >
                <Text style={{ color: color.silk, fontSize: font.body + 1, fontWeight: '700' }}>{WHEEL_LOAD}</Text>
              </Pressable>
            </View>
            {footer}
          </View>
        </>
      )}
    </View>
  )
}

/**
 * A PRESET ON THE WHEEL'S LIST: its name, its slot and its star on one
 * line, with no box round it ("remove the boxes around the outside edge of
 * the presets", Justin, 11 November 2026). The row under the bar is the
 * bar: light, with dark ink. The one being played is amber and says
 * "Playing", as its row in the list does; a colour tag is a short bar
 * before the name.
 *
 * It does what the list's row does and nothing of its own: screens/Presets
 * hands it the same words, press, hold and star it hands the list's.
 */
export function WheelPreset({ label, sub, here = false, bar = null, starred = false, starLabel, hint, onPress, onLongPress, onStar, under = false }) {
  const ink = under ? color.chassis : here ? color.signal : color.silk
  const small = under ? color.chassis : here ? color.signal : color.silkDim
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: WHEEL_ROW, borderRadius: 10, backgroundColor: under ? color.silk : 'transparent' }}>
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
        style={({ pressed }) => ({ flex: 1, height: WHEEL_ROW, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.md, opacity: pressed ? 0.6 : 1 })}
      >
        {bar ? <View style={{ width: 4, height: WHEEL_ROW - 20, borderRadius: 2, backgroundColor: bar }} /> : null}
        <Text numberOfLines={1} style={{ flex: 1, color: ink, fontSize: under ? WHEEL_NAME : WHEEL_NAME_ROUND, fontWeight: '700', opacity: under || here ? 1 : 0.8 }}>
          {label}
        </Text>
        <Text numberOfLines={1} style={{ color: small, fontSize: font.small, fontFamily: face }}>
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
        <Text style={{ color: starred ? (under ? color.chassis : color.signal) : under ? color.chassis : color.silkFaint, fontSize: font.lead, fontFamily: face, opacity: starred || !under ? 1 : 0.45 }}>{starred ? '★' : '☆'}</Text>
      </Pressable>
    </View>
  )
}
