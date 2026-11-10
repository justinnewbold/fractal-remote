import { useRef, useState } from 'react'
import { Animated, PanResponder, Text, View } from 'react-native'
import { color, font } from '../lib/theme'
import { holdSideways, releaseSideways } from '../lib/edge-back'
import { SIDE_LEAST } from '../lib/twoSides'
import { HANDLE_TAP, HANDLE_TWICE_MS, SPLIT_STEP, dragEnds, dragHolds, dragLetsGo } from '../lib/sidesSplit'
import { tick } from '../lib/feedback'

/*
 * THE HANDLE ON THE LINE BETWEEN THE TWO SIDES (lib/sidesSplit says the
 * rules; components/Sides draws this over the line, on a big screen with a
 * tool beside Play, for an account the tidier Edit is open to).
 *
 * "A handle on the line between the halves: tap it to swap, drag it to
 * resize, drag it to the edge for full screen."
 *
 *   tap        swaps the two sides. At once where the line is where the
 *              window has it; where it was dragged, after the moment a
 *              second tap would have come in, because a swap moves the line
 *              (Play keeps its width, on the other side) and the handle
 *              with it, out from under the finger.
 *   two taps   put the line back where the window has it, and swap nothing.
 *   drag       the handle and a guide line follow the finger. THE SIDES DO
 *              NOT: they are laid out again once, when the finger lifts.
 *              Play plans its tiles for its width and Edit its knobs, and
 *              planning both on every frame of a drag would stutter under
 *              the finger; this way a drag costs the two sides one layout.
 *              The guide line turns to the fault colour past where a side
 *              lets go, so letting go is seen before it happens.
 *
 * `resize` false (the Duo's fold, the tuner's narrow column): the handle
 * swaps and does not move.
 *
 * The touch is taken on the way down and not given back (as components/Knob
 * takes its own), and the back swipe is told a sideways drag is held
 * (lib/edge-back), so neither App's swipe back nor a side's own scroll has
 * it. A screen reader gets it as one control: activate swaps, and its
 * adjust moves the line a step at a time, never past a side's least.
 */
export default function SidesHandle({
  /* Where the line is, from the frame's left edge, and how wide the frame is. */
  line = 0,
  width = 0,
  resize = false,
  /* Whether the line is somewhere a drag left it (lib/useSidesSplit `share`): then two taps have something to put back. */
  moved = false,
  playOnRight = true,
  onSwap,
  onReset,
  /* A drag ended with both sides up: Play's new share of the window. */
  onShare,
  /* A drag ended past a side's least: 'play' | 'tool' let go. */
  onLetGo
}) {
  const now = useRef(null)
  now.current = { line, width, resize, moved, playOnRight, onSwap, onReset, onShare, onLetGo }
  const dx = useRef(new Animated.Value(0)).current
  const [held, setHeld] = useState(false)
  /* Which side would let go if the finger lifted now: 'left' | 'right' | null. */
  const [lets, setLets] = useState(null)
  const letsNow = useRef(null)
  /* When the last tap landed, and the swap waiting on a second one. */
  const tapped = useRef(0)
  const waiting = useRef(null)

  const tap = () => {
    const n = now.current
    const at = Date.now()
    const twice = at - tapped.current < HANDLE_TWICE_MS
    tapped.current = twice ? 0 : at
    clearTimeout(waiting.current)
    waiting.current = null
    tick()
    if (twice) {
      n.onReset?.()
      return
    }
    /* Nothing to put back: swap now. Dragged: wait out the second tap first. */
    if (!n.moved) n.onSwap?.()
    else waiting.current = setTimeout(() => now.current.onSwap?.(), HANDLE_TWICE_MS)
  }

  const finish = (g, lost) => {
    const n = now.current
    releaseSideways()
    setHeld(false)
    letsNow.current = null
    setLets(null)
    dx.setValue(0)
    if (lost) return
    if (Math.abs(g.dx) < HANDLE_TAP && Math.abs(g.dy) < HANDLE_TAP) return tap()
    if (!n.resize) return
    const x = n.line + dragHolds({ width: n.width, line: n.line, dx: g.dx })
    const end = dragEnds({ width: n.width, x, playOnRight: n.playOnRight, least: SIDE_LEAST })
    if (end.lets) n.onLetGo?.(end.lets)
    else if (end.share !== null) n.onShare?.(end.share)
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        holdSideways()
        return true
      },
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => setHeld(true),
      onPanResponderMove: (_e, g) => {
        const n = now.current
        if (!n.resize) return
        const by = dragHolds({ width: n.width, line: n.line, dx: g.dx })
        dx.setValue(by)
        const goes = dragLetsGo({ width: n.width, x: n.line + by, least: SIDE_LEAST })
        if (goes !== letsNow.current) {
          letsNow.current = goes
          setLets(goes)
        }
      },
      onPanResponderRelease: (_e, g) => finish(g, false),
      onPanResponderTerminate: (_e, g) => finish(g, true)
    })
  ).current

  /* A screen reader's adjust: the line one step left or right, held at the leasts, never letting a side go. */
  const step = (by) => {
    const n = now.current
    if (!n.resize) return
    const least = Math.max(SIDE_LEAST, Math.min(n.width - SIDE_LEAST, n.line + by))
    const end = dragEnds({ width: n.width, x: least, playOnRight: n.playOnRight, least: SIDE_LEAST })
    if (end.share !== null) n.onShare?.(end.share)
  }

  return (
    <>
      {held && resize ? (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, bottom: 0, left: line - 1, width: 2, backgroundColor: lets ? color.fault : color.signal, transform: [{ translateX: dx }] }}
        />
      ) : null}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: 0, left: line - HIT / 2, width: HIT, justifyContent: 'center' }}>
        <Animated.View
          {...pan.panHandlers}
          accessible
          accessibilityRole={resize ? 'adjustable' : 'button'}
          accessibilityLabel={resize ? 'The line between the two sides. Double tap to swap the sides' : 'Swap the two sides'}
          accessibilityHint={resize ? 'Swipe up or down to make a side wider' : undefined}
          accessibilityActions={resize ? ACTIONS : ACTIVATE}
          onAccessibilityAction={(e) => {
            const name = e.nativeEvent.actionName
            if (name === 'activate') now.current.onSwap?.()
            else if (name === 'increment') step(SPLIT_STEP)
            else if (name === 'decrement') step(-SPLIT_STEP)
          }}
          style={{ width: HIT, height: TALL, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: dx }] }}
        >
          <View
            style={{
              width: WIDE,
              height: TALL,
              borderRadius: WIDE / 2,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: color.panel,
              borderWidth: 1,
              borderColor: held ? color.signal : color.rule
            }}
          >
            {resize ? <Grip /> : null}
            <Text allowFontScaling={false} style={{ color: color.silk, fontSize: font.body, lineHeight: font.body + 2 }}>
              ⇄
            </Text>
            {resize ? <Grip /> : null}
          </View>
        </Animated.View>
      </View>
    </>
  )
}

/* Three short lines: where a finger takes hold, said without a picture. Only where the line can move. */
function Grip() {
  return (
    <View style={{ gap: 3 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 12, height: 2, borderRadius: 1, backgroundColor: color.silkFaint }} />
      ))}
    </View>
  )
}

/* The pill as drawn, and the room round it that a thumb can land in. */
const WIDE = 30
const TALL = 96
const HIT = 44
const ACTIVATE = [{ name: 'activate' }]
const ACTIONS = [{ name: 'activate' }, { name: 'increment' }, { name: 'decrement' }]
