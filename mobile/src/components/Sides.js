import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { color, space } from '../lib/theme'
import { PLAY_ALWAYS, SIDE_LEAST, TOOL_NAMES, TUNER_NARROW_AT, sideWidths } from '../lib/twoSides'
import { resizeOn } from '../lib/sidesSplit'
import EdgeBack from './EdgeBack'
import Press from './Press'
import Sheet from './Sheet'
import SidesHandle from './SidesHandle'

/*
 * TWO SIDES ON A BIG SCREEN: the frame that holds Play on one side and Edit,
 * your setlists or all your presets on the other, with a small bar over
 * each (lib/twoSides says where you get two sides and how they split; App.js
 * says what is open).
 *
 * PLAY STAYS IN ONE PLACE. Play is `children`, and it sits in the same slot
 * of this frame whether the window shows one side or two, whether a tool is
 * open beside it or filling the screen. So opening Edit beside Play, closing
 * it, folding the iPhone Duo or dragging an iPad's divider never draws Play
 * afresh: its open sheets, a tempo half typed and what it has read all stay.
 * Hidden by a tool that fills the screen, Play is kept at width 0 rather
 * than taken down, for the same reason; App.js tells it to sleep then
 * (Stage `awake`), so nothing pops up on a screen nobody can see, and a
 * screen reader skips it.
 *
 * THE TOOL IS `side`: the Edit, Setlists or Presets screen App.js already
 * has, drawn in the other slot. Its own Done closes the side as it always
 * closed the screen, and Play fills the window.
 *
 * THE TWO SIDES' BUTTONS ARE IN THE APP'S TOP BAR (components/SidesLead),
 * not here. Each side had a bar of its own over it until 10 November 2026
 * (its name, Swap, Full screen): "The play and two sides buttons take up a
 * whole row on iPad" (Justin), and a phone held on its side never had the
 * height for one. So this frame draws the two sides and nothing over them,
 * and App hands the same buttons to the top bar: tap a side's name there
 * for the list of what can go beside Play (Edit, Setlists, All presets, the
 * Tuner; Play is never on it, because Play is always the other side), which
 * is the one thing still drawn here, over both sides, opened by App (`list`,
 * `onList`). On a window that shows one side (every phone held upright, the
 * Duo closed, an iPad upright) there is nothing in the bar either, and the
 * screen is exactly what it always was.
 *
 * A SIDEWAYS SWIPE ON PLAY NEVER CLOSES THE SIDE. App's EdgeBack, which
 * wraps every screen, takes a rightward drag as "back", and with a tool open
 * that is Done. Play's slot takes those drags itself and does nothing with
 * them, so a thumb sliding across the scenes does not shut Edit; the tool's
 * side still has the swipe, as its screen always had.
 *
 * ON THE iPHONE DUO the divider is the fold (twoSides splitSides): the
 * window's middle, not the frame's, so the side away from the clock strip
 * is the wider one and nothing you press is on the crease.
 */
export default function Sides({
  /* Whether this account gets two sides at all (App: his, or features SIDES_FOR_EVERYONE). Not: Play alone, in exactly today's tree. */
  allowed = false,
  /* Whether the window shows two sides at all (lib/twoSides twoSidesOn, asked by App on the measured frame). */
  two = false,
  /* The tool on the other side: 'edit' | 'setlists' | 'presets' | 'tuner', or a block's knobs ('block'), or null for Play alone. */
  tool = null,
  /* That tool's screen, drawn in its side. */
  side = null,
  /* The tool fills the window, Play hidden beside it. */
  full = false,
  playOnRight = true,
  /* The frame under the top bar, as App measured it: { width, left, right }. */
  frame = null,
  /* What the list offers right now (twoSides sideTools). */
  tools = [],
  /*
   * THE HANDLE ON THE LINE BETWEEN THE SIDES (components/SidesHandle;
   * lib/sidesSplit), for an account the tidier Edit is open to, on a big
   * screen: `handle` is whether it is drawn at all (App: lib/sidesSplit
   * handleOn), `share` Play's share of the window from the last drag (null
   * for the window's own split), and the four things it does are App's:
   * swap the sides, put the line back, keep a new share, and let a side go
   * ('play' | 'tool') when its edge is dragged past its least. False and
   * null everywhere else, and the two sides are where they always were.
   */
  handle = false,
  share = null,
  onSwap = null,
  onSplitReset = null,
  onShare = null,
  onLetGo = null,
  onPick,
  /* Which side's name was tapped in the top bar, for the list: 'tool' | 'play' | null, and how it is set. Both App's (components/SidesLead draws the names). */
  list = null,
  onList = null,
  children
}) {
  /* Everybody the sides are not open to: Play, and not one View around it, so their tree is today's. */
  if (!allowed) return children
  const widths = sideWidths({ width: frame?.width, left: frame?.left, right: frame?.right, playOnRight, tool, share })
  const beside = two && Boolean(tool) && !full
  const playHidden = Boolean(tool) && full

  const pick = (t) => {
    onList?.(null)
    onPick?.(t)
  }

  const play = (
    <View
      key="play"
      style={playHidden ? HIDDEN : beside ? { width: widths.play } : { flex: 1 }}
      accessibilityElementsHidden={playHidden}
      importantForAccessibility={playHidden ? 'no-hide-descendants' : 'auto'}
    >
      {/* The same View around Play in every mode (EdgeBack draws one, and with no onBack takes no touch), so Play is never drawn afresh when a side opens. */}
      <EdgeBack onBack={beside ? swallow : null} style={{ flex: 1 }}>
        {children}
      </EdgeBack>
    </View>
  )
  const other = tool ? (
    <View key="side" style={[beside ? { width: widths.tool } : { flex: 1 }, beside ? DIVIDED[playOnRight ? 'left' : 'right'] : null]}>
      <View style={{ flex: 1 }}>{side}</View>
    </View>
  ) : null

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* The tool on the left and Play on the right, or swapped: the same two Views, keyed, so a swap moves them and draws neither afresh. */}
      {playOnRight ? other : play}
      {playOnRight ? play : other}
      {/* On the line between them, over both: tap to swap, drag to resize where the line may move (not on the Duo's fold, not the tuner's narrow column). */}
      {handle && beside ? (
        <SidesHandle
          line={playOnRight ? widths.tool : widths.play}
          width={frame?.width || 0}
          resize={resizeOn({ width: frame?.width, left: frame?.left, right: frame?.right, tool, least: SIDE_LEAST, narrowAt: TUNER_NARROW_AT })}
          moved={share !== null}
          playOnRight={playOnRight}
          onSwap={onSwap}
          onReset={onSplitReset}
          onShare={onShare}
          onLetGo={onLetGo}
        />
      ) : null}
      <Sheet open={list !== null} onClose={() => onList?.(null)} title={list === 'play' ? 'Beside Play' : 'This side'} note={PLAY_ALWAYS}>
        <View style={{ gap: space.sm }}>
          {tools.map((t) => (
            <Press key={t} label={TOOL_NAMES[t]} tone="signal" on={t === tool} onPress={() => pick(t)} />
          ))}
        </View>
      </Sheet>
    </View>
  )
}

/** Takes a back swipe on Play and does nothing with it (see the note on Sides). */
const swallow = () => {}

/* A side kept but out of sight: no width, nothing drawn past its edge, and nothing for a screen reader. */
const HIDDEN = { width: 0, overflow: 'hidden' }
/* The line between the sides, on the tool's edge that meets Play. */
const DIVIDED = {
  left: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: color.rule },
  right: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: color.rule }
}

/**
 * THE FRAME UNDER THE TOP BAR, measured for App.js: how much room the app
 * has, clear of the phone's own edges, and what the phone keeps down each
 * side (the Duo's strip), which the divider is placed by. It fills its
 * parent without taking part in its layout, draws nothing and takes no
 * touch, so nothing on screen moves for it. Drawn only for an account the
 * two sides are open to: everybody else's tree is exactly today's.
 */
export function SidesFrame({ onFrame }) {
  const { left, right } = useSafeAreaInsets()
  const size = useRef(null)
  const tell = useRef(onFrame)
  tell.current = onFrame
  /* The strip can change sides without the frame changing size (the Duo turned over): said again then. */
  useEffect(() => {
    if (size.current) tell.current?.({ ...size.current, left, right })
  }, [left, right])
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      collapsable={false}
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0 }}
      onLayout={(e) => {
        size.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }
        tell.current?.({ ...size.current, left, right })
      }}
    />
  )
}
