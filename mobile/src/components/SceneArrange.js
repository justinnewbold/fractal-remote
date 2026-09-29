import { useEffect, useRef, useState } from 'react'
import { Animated, PanResponder, View } from 'react-native'

import { space } from '../lib/theme'
import { thud } from '../lib/feedback'
import { sceneColor } from '../lib/sceneColors'
import { swapScenes } from '../lib/gigSize'
import Tile from './Tile'

/**
 * ARRANGE SCENES: HOLD ONE, DRAG IT ONTO ANOTHER, AND THEY SWAP.
 *
 * "Can you make it so you can grab and drop the scenes wherever you want them
 * on the screen? Because that would be cool." Here, on the Appearance page,
 * and nowhere near Play: a finger that slips on a stage mid-song must be able
 * to change the scene, never to move one.
 *
 * Two columns, eight tiles, in the same colours as Play — scene 5 is the same
 * blue here as on the stage, so what is being moved is recognised rather than
 * read. A drop swaps the two places rather than shuffling everything along,
 * because a swap is one thing to check afterwards and a shuffle is eight.
 *
 * Plain React Native: a PanResponder per tile and an Animated offset for the
 * one being carried. A library for this would be native code, and native code
 * costs a build.
 *
 * The page does not scroll while a tile is held — the same rule the knobs and
 * the chain's grips follow, for the same reason: on iOS the scroll view's pan
 * is native and takes the touch back unless it is told not to. See Knob.
 */
const HEIGHT = 64

export default function SceneArrange({ order, onChange, onScrollLock }) {
  const [width, setWidth] = useState(0)
  /* Which place is being carried, and which place it is over. */
  const [drag, setDrag] = useState(null)
  /*
   * AND A TAP DOES IT TOO: tap one scene, then the one to swap it with.
   *
   * "The one for the drag and drop scenes isn't working." A drag on a phone
   * is a fight with the page's own scroll, and a fight can be lost; two taps
   * cannot. So both work, and whichever the finger does first is the one it
   * gets.
   */
  const [picked, setPicked] = useState(null)
  const pickedRef = useRef(null)
  const pick = (k) => {
    pickedRef.current = k
    setPicked(k)
  }
  const offset = useRef(new Animated.ValueXY()).current
  const tileW = width > 0 ? (width - space.sm) / 2 : 0
  const rows = Math.ceil(order.length / 2)

  const spot = (k) => ({ left: (k % 2) * (tileW + space.sm), top: Math.floor(k / 2) * (HEIGHT + space.sm) })
  /* The place under a point in the grid, or null when it is off the grid. */
  const placeAt = (x, y) => {
    if (tileW <= 0) return null
    const col = x < tileW + space.sm / 2 ? 0 : 1
    const row = Math.floor((y + space.sm / 2) / (HEIGHT + space.sm))
    if (x < -space.sm || x > width + space.sm || row < 0 || row >= rows) return null
    const k = row * 2 + col
    return k < order.length ? k : null
  }

  /* The newest of everything, for the responders made once below. */
  const live = useRef({})
  live.current = { order, onChange, onScrollLock, spot, placeAt, tileW }
  /* A page left locked by a finger that never lifted would never scroll again. */
  useEffect(() => () => live.current.onScrollLock?.(false), [])

  /* Kept in a ref as well as in state: the drop reads the ref, so it swaps
     exactly once whatever React does with the render. */
  const held = useRef(null)
  const show = (d) => {
    held.current = d
    setDrag(d)
  }
  const start = (k) => {
    offset.setValue({ x: 0, y: 0 })
    live.current.onScrollLock?.(true)
    show({ from: k, over: k, moved: false })
  }
  const move = (k, dx, dy) => {
    /* Under a thumb's wobble it is still a tap, not a drag. */
    if (!held.current?.moved && Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    if (!held.current?.moved) thud()
    offset.setValue({ x: dx, y: dy })
    const { spot: at, placeAt: under, tileW: w } = live.current
    const from = at(k)
    const over = under(from.left + w / 2 + dx, from.top + HEIGHT / 2 + dy)
    if (held.current?.over !== over || !held.current?.moved) show({ from: k, over, moved: true })
  }
  const end = (k, dropped) => {
    live.current.onScrollLock?.(false)
    offset.setValue({ x: 0, y: 0 })
    const over = held.current?.over
    const moved = held.current?.moved
    show(null)
    if (!dropped) return
    if (!moved) {
      /* A tap: the first one picks, the second swaps, the same one again lets go. */
      const was = pickedRef.current
      if (was === null) {
        thud()
        pick(k)
      } else {
        pick(null)
        if (was !== k) live.current.onChange?.(swapScenes(live.current.order, was, k))
      }
      return
    }
    pick(null)
    if (over !== null && over !== undefined && over !== k) {
      live.current.onChange?.(swapScenes(live.current.order, k, over))
    }
  }

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: rows * HEIGHT + Math.max(0, rows - 1) * space.sm }}
    >
      {tileW > 0
        ? order.map((scene, k) => (
            <Place
              key={scene}
              place={k}
              scene={scene}
              width={tileW}
              at={spot(k)}
              carried={!!drag?.moved && drag.from === k}
              target={(!!drag?.moved && drag.from !== k && drag.over === k) || picked === k}
              offset={offset}
              onStart={start}
              onMove={move}
              onEnd={end}
              onLock={() => live.current.onScrollLock?.(true)}
            />
          ))
        : null}
    </View>
  )
}

function Place({ place, scene, width, at, carried, target, offset, onStart, onMove, onEnd, onLock }) {
  const live = useRef({ place, onStart, onMove, onEnd, onLock })
  useEffect(() => {
    live.current = { place, onStart, onMove, onEnd, onLock }
  })
  const pan = useRef(
    PanResponder.create({
      /* The page's scroll locked HERE, on touch-down, before the scroll view
         has decided this is a scroll — the lesson the knobs learned. Locking
         at the grant was one hop late, and the page kept the finger. */
      onStartShouldSetPanResponderCapture: () => {
        live.current.onLock?.()
        return true
      },
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => live.current.onStart(live.current.place),
      onPanResponderMove: (_, g) => live.current.onMove(live.current.place, g.dx, g.dy),
      onPanResponderRelease: () => live.current.onEnd(live.current.place, true),
      onPanResponderTerminate: () => live.current.onEnd(live.current.place, false)
    })
  ).current
  const hue = sceneColor(scene)
  return (
    <Animated.View
      {...pan.panHandlers}
      /* The tile is only a picture here: the whole place takes the touch. */
      pointerEvents="box-only"
      accessibilityRole="button"
      accessibilityLabel={`Scene ${scene + 1}, place ${place + 1}`}
      accessibilityHint="Tap, then tap another scene to swap them, or drag it onto one"
      style={{
        position: 'absolute',
        left: at.left,
        top: at.top,
        width,
        /* The carried tile rides above the others and follows the finger. */
        zIndex: carried ? 2 : 1,
        elevation: carried ? 6 : 0,
        opacity: target ? 0.55 : 1,
        transform: carried ? offset.getTranslateTransform() : []
      }}
    >
      <Tile
        caption="Scene"
        label={String(scene + 1)}
        bar
        fill={hue.fill}
        ink={hue.ink}
        on={carried || target}
        height={HEIGHT}
        style={{ width }}
      />
    </Animated.View>
  )
}
