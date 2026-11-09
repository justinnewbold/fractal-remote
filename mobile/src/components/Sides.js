import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { color, font, space } from '../lib/theme'
import { PLAY_ALWAYS, SIDE_WORDS, TOOL_NAMES, sideWidths } from '../lib/twoSides'
import EdgeBack from './EdgeBack'
import Press from './Press'
import Sheet from './Sheet'

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
 * THE BARS. Each side has one: its name, Swap and Full screen. Tap a name
 * for the list of what can go beside Play (Edit, Setlists, All presets; Play
 * is never on it, because Play is always the other side, and PLAY's own
 * name gives the same list). Full screen makes that side fill the window,
 * and its bar then says Two sides, which brings the other side back as it
 * was. With Play alone on a wide window its bar says PLAY and Two sides:
 * the tool kept from before comes back, or, with none yet, the list opens.
 * No bar at all on a window that shows one side: every phone held upright,
 * the Duo closed, an iPad upright, is exactly today's screen.
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
  /* The tool on the other side: 'edit' | 'setlists' | 'presets', or null for Play alone. */
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
  /* A tool kept from before, for Two sides on Play's bar. */
  kept = null,
  onPick,
  onSwap,
  onFull,
  onPlayFull,
  onTwoSides,
  children
}) {
  /* Which bar's name was tapped, for the list: 'tool' or 'play', or null. */
  const [list, setList] = useState(null)
  /* Everybody the sides are not open to: Play, and not one View around it, so their tree is today's. (After the hook above, so its count never changes.) */
  if (!allowed) return children
  const widths = sideWidths({ width: frame?.width, left: frame?.left, right: frame?.right, playOnRight })
  const beside = two && Boolean(tool) && !full
  const playHidden = Boolean(tool) && full
  const toolName = TOOL_NAMES[tool] || ''

  const pick = (t) => {
    setList(null)
    onPick?.(t)
  }

  /* Play's bar: beside a tool, Swap and Full screen; alone on a wide window, Two sides. */
  const playBar = two ? (
    <SideBar
      name={TOOL_NAMES.play}
      onName={() => setList('play')}
      onSwap={beside ? onSwap : null}
      onFull={beside ? onPlayFull : null}
      onTwo={beside ? null : kept ? onTwoSides : () => setList('play')}
    />
  ) : null
  /* The tool's bar: beside Play, Swap and Full screen; filling a wide window, Two sides. None on a window too narrow for two, where its Done is the way out. */
  const toolBar = two && tool ? (
    <SideBar
      name={toolName}
      onName={() => setList('tool')}
      onSwap={beside ? onSwap : null}
      onFull={beside ? () => onFull?.(true) : null}
      onTwo={beside ? null : () => onFull?.(false)}
    />
  ) : null

  const play = (
    <View
      key="play"
      style={playHidden ? HIDDEN : beside ? { width: widths.play } : { flex: 1 }}
      accessibilityElementsHidden={playHidden}
      importantForAccessibility={playHidden ? 'no-hide-descendants' : 'auto'}
    >
      {playBar}
      {/* The same View around Play in every mode (EdgeBack draws one, and with no onBack takes no touch), so Play is never drawn afresh when a side opens. */}
      <EdgeBack onBack={beside ? swallow : null} style={{ flex: 1 }}>
        {children}
      </EdgeBack>
    </View>
  )
  const other = tool ? (
    <View key="side" style={[beside ? { width: widths.tool } : { flex: 1 }, beside ? DIVIDED[playOnRight ? 'left' : 'right'] : null]}>
      {toolBar}
      <View style={{ flex: 1 }}>{side}</View>
    </View>
  ) : null

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* The tool on the left and Play on the right, or swapped: the same two Views, keyed, so a swap moves them and draws neither afresh. */}
      {playOnRight ? other : play}
      {playOnRight ? play : other}
      <Sheet open={list !== null} onClose={() => setList(null)} title={list === 'play' ? 'Beside Play' : 'This side'} note={PLAY_ALWAYS}>
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

/** How tall each side's bar is: its 44-point buttons with a little air. */
export const BAR_TALL = 52
const BUTTON = 44

/**
 * One side's bar: its name on the left, which opens the list, and on the
 * right Swap and Full screen, or Two sides when this side fills the window.
 */
function SideBar({ name, onName, onSwap, onFull, onTwo }) {
  return (
    <View
      style={{
        height: BAR_TALL,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: color.rule
      }}
    >
      <Press label={`${name} ▾`} height={BUTTON} labelSize={font.small} onPress={onName} accessibilityLabel={`${name}. Choose what goes beside Play`} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {onSwap ? <Press label={SIDE_WORDS.swap} height={BUTTON} labelSize={font.small} onPress={onSwap} accessibilityLabel="Swap the two sides" /> : null}
        {onFull ? <Press label={SIDE_WORDS.full} height={BUTTON} labelSize={font.small} onPress={onFull} accessibilityLabel={`${name} fills the screen`} /> : null}
        {onTwo ? <Press label={SIDE_WORDS.two} height={BUTTON} labelSize={font.small} onPress={onTwo} accessibilityLabel="Show two sides" /> : null}
      </View>
    </View>
  )
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
