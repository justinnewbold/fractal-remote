import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder, Platform, Pressable, Text, View } from 'react-native'

import { color, font, mono, space } from '../lib/theme'
import {
  WHEEL_FLY_SAY_MS,
  WHEEL_GAP,
  WHEEL_NAME,
  WHEEL_NAME_ROUND,
  WHEEL_NOTCH_DEG,
  WHEEL_REDRAW,
  WHEEL_REST_MS,
  WHEEL_ROW,
  WHEEL_SPARE,
  WHEEL_STILL_MS,
  clickDue,
  onWheelRing,
  wheelAngle,
  wheelAround,
  wheelCoast,
  wheelDrawn,
  wheelFlow,
  wheelFlowStart,
  wheelFlying,
  wheelGain,
  wheelGlideAt,
  wheelLayout,
  wheelLetGo,
  wheelPace,
  wheelPlace,
  wheelRow,
  wheelSettle,
  wheelUnder
} from '../lib/presetWheel'
import { closeWheelClick, openWheelClick, wheelClick } from '../lib/wheelClick'
import { thud, tick } from '../lib/feedback'
import { fire, said } from '../lib/tapped'

const face = Platform.select(mono)

/* How wide the star's place is at the end of a row: a thumb's 44. */
const WHEEL_END = 44
/* What the middle button says. */
export const WHEEL_LOAD = 'Load'
/* A click's two halves, both wanted unless the setting says otherwise. */
const BOTH = Object.freeze({ sound: true, tap: true })
/* The marks on the ring that go round with it: eight, so a fast spin still reads as turning the way it is. */
const WHEEL_MARKS = [0, 45, 90, 135, 180, 225, 270, 315]

/* When a touch happened, by the touch's own clock where it has one: the speed of a thumb is worked out from these. */
const stamp = (e) => Number(e?.nativeEvent?.timestamp) || Date.now()

/**
 * ALL PRESETS ON A CLICK WHEEL THAT GLIDES (lib/presetWheel has the why and
 * the arithmetic).
 *
 * A ring to run a thumb round, a short list over it that slides under a
 * bar on its middle row, and a button in the middle of the ring. THE APP
 * MOVES THE LIST ITSELF: where it is (`where`, in rows) is this file's own
 * number, and one function (`put`) sets it, slides the strip, and fires the
 * click and the tap the moment a new preset comes under the bar. The
 * thumb's turn goes through it, and so does a coast after a flick, a frame
 * at a time (`run`). Nothing here is a scrolling list, so a click cannot
 * be late. NOTHING LOADS UNTIL THE MIDDLE BUTTON OR A ROW IS PRESSED, and
 * both do what screens/Presets hands the row: this file draws and moves,
 * and never loads, stars or saves.
 *
 * `row(item)` answers what a preset's row says and does (the list's own
 * words, press, hold and star). `listRef` is given the two things the
 * screen asks of its list: toRow(i) and toTop().
 */
export default function PresetWheel({ listRef, data, row, startAt = 0, clicks = true, feel = BOTH, onAround, footer = null, empty = null }) {
  const count = data.length
  const counted = useRef(count)
  counted.current = count
  const clicking = useRef(clicks)
  clicking.current = clicks
  /* Which halves of a click are wanted: the sound, the tap, or both (lib/presetWheel wheelFeel). */
  const feeling = useRef(feel)
  feeling.current = feel
  const items = useRef(data)
  items.current = data
  const around = useRef(onAround)
  around.current = onAround

  /* What a row says and does, as the screen last handed it. A row is drawn again when the screen hands a new one (a name has arrived, a star has changed), never because the list moved. */
  const look = useRef(row)
  const handed = useRef(0)
  if (look.current !== row) {
    look.current = row
    handed.current += 1
  }

  /* How big the room is, and so how big the ring and how many rows. Nothing is drawn until it is known. */
  const [box, setBox] = useState({ w: 0, h: 0 })
  const plan = useMemo(() => wheelLayout(box.w, box.h), [box.w, box.h])

  /*
   * WHERE THE LIST IS. `where` is the place in rows, between two as often
   * as on one; `on` is the preset under the bar, the nearest. `slide` is
   * the same place as the strip's offset, set straight from here on every
   * move, so the strip slides without anything being drawn again.
   */
  const where = useRef(wheelPlace(startAt, count))
  const on = useRef(wheelRow(where.current, count))
  const slide = useRef(new Animated.Value(-Math.max(0, where.current) * WHEEL_ROW)).current
  /* The row the strip's rows were last drawn round, and the one the bar came to rest on (the middle button's words). */
  const drawn = useRef(on.current)
  const [centre, setCentre] = useState(on.current)
  const [rested, setRested] = useState(on.current)

  /* The marks on the ring, which go round with the thumb and with a coast. */
  const spun = useRef(0)
  const marks = useRef(new Animated.Value(0)).current
  const roll = useCallback(
    (degrees) => {
      if (!degrees) return
      spun.current = (((spun.current + degrees) % 360) + 360) % 360
      marks.setValue(spun.current)
    },
    [marks]
  )

  /* The rows drawn again, round the preset under the bar: the one place they are. */
  const redraw = useCallback(() => {
    if (drawn.current === on.current) return
    drawn.current = on.current
    setCentre(on.current)
  }, [])

  /*
   * FLYING (lib/presetWheel has the why): past a speed the rows are put
   * away and one line says the slot the list is passing, so nothing is
   * drawn again while it flies. `pace` is how fast the list is moving;
   * `soaring` whether it is flying this instant; `line` is that one line,
   * told where the list is a few times a second. It lands when the list
   * slows, when it comes to rest, or when no move has come for a moment
   * (a thumb stopped dead on the ring), and the rows come back once.
   */
  const pace = useRef(null)
  const soaring = useRef(false)
  const [flying, setFlying] = useState(false)
  const line = useRef(null)
  const lineSaid = useRef(0)
  const landing = useRef(null)
  const land = useCallback(() => {
    clearTimeout(landing.current)
    if (soaring.current) {
      soaring.current = false
      setFlying(false)
    }
    redraw()
  }, [redraw])
  useEffect(() => () => clearTimeout(landing.current), [])

  /* The names around the bar are asked for once the list rests, never during a spin or a coast: each name is a read of the unit (lib/presetNames). */
  const rest = useRef(null)
  const calm = useCallback(() => {
    pace.current = null
    land()
    setRested(on.current)
    clearTimeout(rest.current)
    rest.current = setTimeout(() => around.current?.(wheelAround(on.current, counted.current)), WHEEL_REST_MS)
  }, [land])
  useEffect(() => () => clearTimeout(rest.current), [])

  /*
   * ONE PLACE THE LIST IS MOVED FROM. The strip slides to `place`, and if
   * that brings a new preset under the bar, the click and the tap go with
   * it, here and nowhere else. At either end of the list it stops, and a
   * list that moved nothing does not click.
   */
  const lastClick = useRef(0)
  const put = useCallback(
    (place, loud = true) => {
      const next = wheelPlace(place, counted.current)
      if (next < 0) return
      const now = Date.now()
      pace.current = wheelPace(pace.current, next - where.current, now)
      where.current = next
      slide.setValue(-next * WHEEL_ROW)
      const under = wheelUnder(next, on.current, counted.current)
      const passed = under !== on.current
      on.current = under
      if (passed && loud && clicking.current && clickDue(now, lastClick.current)) {
        lastClick.current = now
        wheelClick(feeling.current)
      }
      /* Flying, or not: the rows are put away past a speed, and nothing is drawn again until it lands. */
      const fly = wheelFlying(soaring.current, pace.current.rate)
      if (fly && !soaring.current) {
        soaring.current = true
        setFlying(true)
      } else if (!fly && soaring.current) land()
      if (soaring.current) {
        if (now - lineSaid.current >= WHEEL_FLY_SAY_MS) {
          lineSaid.current = now
          line.current?.say(under)
        }
        clearTimeout(landing.current)
        landing.current = setTimeout(land, WHEEL_STILL_MS)
        return
      }
      if (passed && Math.abs(under - drawn.current) >= WHEEL_REDRAW) redraw()
    },
    [land, redraw, slide]
  )

  /*
   * A COAST OR A SETTLE, a frame at a time: its course says where the list
   * is at each moment (lib/presetWheel `wheelGlideAt`), and every frame
   * goes through `put`, so a coast clicks as a turn of the thumb does.
   * `per` is what a notch was worth when the thumb let go, so the marks on
   * the ring carry on at the thumb's speed, not the list's.
   */
  const glide = useRef(null)
  const stop = useCallback(() => {
    if (!glide.current) return false
    cancelAnimationFrame(glide.current.frame)
    glide.current = null
    return true
  }, [])
  const run = useCallback(
    (course, per = 1) => {
      stop()
      if (!course) return
      if (!(course.ms > 0)) {
        put(course.to)
        calm()
        return
      }
      const going = { course, began: Date.now(), frame: 0, last: course.from }
      const frame = () => {
        if (glide.current !== going) return
        const ms = Date.now() - going.began
        const place = wheelGlideAt(course, ms)
        roll(((place - going.last) * WHEEL_NOTCH_DEG) / per)
        going.last = place
        put(place)
        if (ms >= course.ms) {
          glide.current = null
          calm()
          return
        }
        going.frame = requestAnimationFrame(frame)
      }
      glide.current = going
      going.frame = requestAnimationFrame(frame)
    },
    [calm, put, roll, stop]
  )
  useEffect(() => stop, [stop])

  /* The list to a row outright: opening, a jump, a search. No click: nobody turned the wheel. */
  const go = useCallback(
    (index) => {
      stop()
      const next = wheelRow(index, counted.current)
      where.current = next
      on.current = next
      slide.setValue(-Math.max(0, next) * WHEEL_ROW)
      calm()
    },
    [calm, slide, stop]
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
    calm()
  }, [calm])

  /* The sound's players live as long as a wheel that clicks out loud is on screen: none are made for a wheel that only taps. */
  const heard = clicks && feel?.sound !== false
  useEffect(() => {
    if (!heard) return undefined
    openWheelClick()
    return closeWheelClick
  }, [heard])

  /*
   * THE RING. Where the thumb is round the middle is read from the touch
   * itself: the first touch says where on the ring it landed, and so where
   * the ring's middle is on the page, and every move after is measured
   * from there. (Nothing inside the ring takes a touch, so the ring is
   * what the first touch lands on; the middle button is over it, not in
   * it.) A thumb that wanders off the ring keeps turning it until it lifts.
   *
   * A thumb landing stops a coast, as a hand on a spinning wheel does.
   * Turning moves the list by what the turn is worth at that speed, and
   * the list stays wherever the thumb has it, between two rows as often as
   * on one: settling it under a thumb that had only paused would throw
   * away the part of a notch already turned, and a slow, careful thumb
   * would never get anywhere. A thumb lifted while still turning lets the
   * list coast from the speed it had; lifted after it stopped, the list
   * settles on the nearest row.
   */
  const flow = useRef(null)
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
    const letGo = (e, flick) => {
      setTurning(false)
      const speed = flick ? wheelLetGo(flow.current, stamp(e), counted.current) : 0
      const per = wheelGain(flow.current?.speed, counted.current)
      flow.current = null
      run(wheelCoast(where.current, speed, counted.current), per)
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: onRing,
      onPanResponderGrant: (e) => {
        stop()
        const d = size.current.ring
        middle.current = { x: e.nativeEvent.pageX - e.nativeEvent.locationX + d / 2, y: e.nativeEvent.pageY - e.nativeEvent.locationY + d / 2 }
        const angle = angleOf(e)
        flow.current = wheelFlowStart(angle, stamp(e))
        dot.setValue(angle)
        setTurning(true)
      },
      onPanResponderMove: (e) => {
        /* Too near the middle to say which way round: the angle there swings with a hair of movement. */
        if (Math.hypot(e.nativeEvent.pageX - middle.current.x, e.nativeEvent.pageY - middle.current.y) < size.current.inner * 0.6) return
        const angle = angleOf(e)
        const turned = wheelFlow(flow.current, angle, stamp(e), counted.current)
        flow.current = turned.state
        dot.setValue(angle)
        roll(turned.turned)
        if (turned.rows) put(where.current + turned.rows)
      },
      onPanResponderRelease: (e) => letGo(e, true),
      onPanResponderTerminate: (e) => letGo(e, false),
      /* Nothing takes the wheel from a thumb that is turning it. */
      onPanResponderTerminationRequest: () => false
    })
  }, [dot, put, roll, run, stop])

  /*
   * THE ROWS, DRAGGED AND FLICKED: a row of thumb for a row of list while
   * the thumb is down, and a coast from the thumb's own speed when it
   * lifts. A touch on a list that is coasting stops it, and is not a press
   * of whatever row was passing. A tap on a list at rest is still the
   * row's own.
   */
  const pull = useRef({ from: 0, base: 0, at: 0 })
  const rows = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => glide.current?.course.kind === 'coast',
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: (_, g) => {
          stop()
          pull.current = { from: where.current, base: g.dy, at: Date.now() }
        },
        onPanResponderMove: (_, g) => {
          const was = where.current
          pull.current.at = Date.now()
          put(pull.current.from - (g.dy - pull.current.base) / WHEEL_ROW)
          roll((where.current - was) * WHEEL_NOTCH_DEG)
        },
        /* The thumb's speed is in points a millisecond, down the screen: back up the list. It is only as new as the last move, so a thumb that stopped before it lifted is not a flick. */
        onPanResponderRelease: (_, g) => run(wheelCoast(where.current, Date.now() - pull.current.at > WHEEL_STILL_MS ? 0 : (-g.vy * 1000) / WHEEL_ROW, counted.current)),
        onPanResponderTerminate: () => run(wheelSettle(where.current, counted.current))
      }),
    [put, roll, run, stop]
  )

  /* A screen reader turns it a preset at a time. */
  const nudge = useCallback(
    (by) => {
      stop()
      put(on.current + by)
      calm()
    },
    [calm, put, stop]
  )

  const reach = plan.middle + WHEEL_SPARE
  const strip = wheelDrawn(centre, reach, count)
  const pool = 2 * reach + 1
  const resting = rested >= 0 && rested < count ? row(data[rested]) : null
  const d = plan.ring
  const knob = Math.round(plan.inner * 2)
  const band = (d / 2 + plan.inner) / 2

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {!box.h ? null : !count ? (
        <View style={{ paddingHorizontal: space.lg }}>{empty}</View>
      ) : (
        <>
          <View {...rows.panHandlers} style={{ height: plan.rows * WHEEL_ROW, overflow: 'hidden' }}>
            {/* The strip: every drawn preset at its own place down it, and the whole of it slid under the bar. */}
            <Animated.View style={{ position: 'absolute', left: space.lg, right: space.lg, top: plan.middle * WHEEL_ROW, height: count * WHEEL_ROW, opacity: flying ? 0 : 1, transform: [{ translateY: slide }] }}>
              {strip.map((index) => (
                <WheelSlot key={index % pool} index={index} item={data[index]} look={look} handed={handed.current} />
              ))}
            </Animated.View>
            {/* The bar: fixed on the middle row, light, with the same strip inside it in dark ink, so a name changes colour as it slides in. It takes no touch: a tap on it is the row's under it. */}
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ position: 'absolute', left: space.lg, right: space.lg, top: plan.middle * WHEEL_ROW, height: WHEEL_ROW, borderRadius: 10, backgroundColor: color.silk, overflow: 'hidden', opacity: flying ? 0 : 1 }}
            >
              <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: count * WHEEL_ROW, transform: [{ translateY: slide }] }}>
                {wheelDrawn(centre, WHEEL_SPARE, count).map((index) => (
                  <WheelSlot key={index % (2 * WHEEL_SPARE + 1)} index={index} item={data[index]} look={look} handed={handed.current} under />
                ))}
              </Animated.View>
            </View>
            {/* While the list flies: the one line that says where it is, in the rows' place. */}
            <WheelFlying ref={line} shown={flying} items={items} look={look} start={on.current} />
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: WHEEL_GAP }}>
            <View style={{ width: d, height: d }}>
              <View
                {...ring.panHandlers}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Preset wheel"
                accessibilityValue={{ text: resting ? [resting.label, resting.sub].filter(Boolean).join(', ') : '' }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
                style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: color.panelHi, borderWidth: 1, borderColor: color.rule }}
              >
                {/* The marks that go round with the wheel, under the thumb and through a coast. Never in the way of the touch. */}
                <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: d, height: d, transform: [{ rotate: marks.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }] }}>
                  {WHEEL_MARKS.map((at) => (
                    <View
                      key={at}
                      style={{
                        position: 'absolute',
                        left: d / 2 + band * Math.cos((at * Math.PI) / 180) - 3,
                        top: d / 2 + band * Math.sin((at * Math.PI) / 180) - 3,
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: color.silkFaint
                      }}
                    />
                  ))}
                </Animated.View>
                {/* Where the thumb is on the ring, while it is: a spot that goes round with it. */}
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
              {/* The middle button: it loads the preset under the bar, by that row's own press. Pressed on a list that is still coasting, it stops the list there first. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={resting ? `${WHEEL_LOAD} ${resting.label}` : WHEEL_LOAD}
                disabled={!resting}
                onPress={() => {
                  thud()
                  if (stop()) {
                    put(on.current, false)
                    calm()
                  }
                  const under = on.current >= 0 && on.current < count ? row(data[on.current]) : null
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
 * THE LINE THAT SAYS WHERE A FLYING LIST IS: the slot it is passing, big,
 * and that preset's name under it. Its own small piece, told where the list
 * is (`say`) a few times a second, so nothing else on the wheel is drawn
 * again for it. It takes no touch, and a screen reader is not told a
 * number that changes many times a second: the ring says the preset when
 * the list rests.
 */
const WheelFlying = forwardRef(function WheelFlying({ shown, items, look, start = 0 }, ref) {
  const [at, setAt] = useState(start)
  useImperativeHandle(ref, () => ({ say: (index) => setAt(index) }), [])
  if (!shown) return null
  const item = items.current[at]
  const says = item === undefined ? null : look.current(item)
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: space.lg, right: space.lg, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Text numberOfLines={1} style={{ color: color.silk, fontSize: 44, fontWeight: '700', fontFamily: face }}>
        {String(says?.sub || '').split(' · ')[0]}
      </Text>
      <Text numberOfLines={1} style={{ color: color.silkDim, fontSize: WHEEL_NAME, fontWeight: '700' }}>
        {says?.label || ''}
      </Text>
    </View>
  )
})

/**
 * ONE PLACE ON THE STRIP. A preset sits at its own place down the strip,
 * and a place is kept and handed the next preset when the bar has moved on
 * (its key is its turn, not its preset), so moving through the list changes
 * what a few places say and makes nothing new. It is drawn again only when
 * it is handed another preset, or the screen hands the wheel new rows.
 */
const WheelSlot = memo(function WheelSlot({ index, item, look, under = false }) {
  const says = look.current(item)
  return <View style={{ position: 'absolute', left: 0, right: 0, top: index * WHEEL_ROW, height: WHEEL_ROW }}>{under ? <WheelName {...says} /> : <WheelPreset {...says} />}</View>
})

/**
 * A PRESET ON THE WHEEL'S LIST: its name, its slot and its star on one
 * line, with no box round it ("remove the boxes around the outside edge of
 * the presets", Justin, 11 November 2026). The one being played is amber
 * and says "Playing", as its row in the list does; a colour tag is a short
 * bar before the name. (Under the bar the same line is drawn again in dark
 * ink, `WheelName`, below.)
 *
 * It does what the list's row does and nothing of its own: screens/Presets
 * hands it the same words, press, hold and star it hands the list's.
 */
export function WheelPreset({ label, sub, here = false, bar = null, starred = false, starLabel, hint, onPress, onLongPress, onStar }) {
  const ink = here ? color.signal : color.silk
  const small = here ? color.signal : color.silkDim
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: WHEEL_ROW }}>
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
        <Text numberOfLines={1} style={{ flex: 1, color: ink, fontSize: WHEEL_NAME_ROUND, fontWeight: '700', opacity: here ? 1 : 0.8 }}>
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
        <Text style={{ color: starred ? color.signal : color.silkFaint, fontSize: font.lead, fontFamily: face }}>{starred ? '★' : '☆'}</Text>
      </Pressable>
    </View>
  )
}

/**
 * THE SAME PRESET AS THE BAR SHOWS IT: the line above again, laid out the
 * same to the point, in dark ink for the light bar, and nothing to press
 * (the bar takes no touch; the row under it does). The two are slid by the
 * same number, so a name passing the bar's edge is light outside it and
 * dark inside it, with no join.
 */
export function WheelName({ label, sub, bar = null, starred = false }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: WHEEL_ROW }}>
      <View style={{ flex: 1, height: WHEEL_ROW, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.md }}>
        {bar ? <View style={{ width: 4, height: WHEEL_ROW - 20, borderRadius: 2, backgroundColor: bar }} /> : null}
        <Text numberOfLines={1} style={{ flex: 1, color: color.chassis, fontSize: WHEEL_NAME, fontWeight: '700' }}>
          {label}
        </Text>
        <Text numberOfLines={1} style={{ color: color.chassis, fontSize: font.small, fontFamily: face }}>
          {sub}
        </Text>
      </View>
      <View style={{ width: WHEEL_END, height: WHEEL_ROW, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: color.chassis, fontSize: font.lead, fontFamily: face, opacity: starred ? 1 : 0.45 }}>{starred ? '★' : '☆'}</Text>
      </View>
    </View>
  )
}
