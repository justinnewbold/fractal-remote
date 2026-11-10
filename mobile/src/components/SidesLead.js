import { useState } from 'react'
import { View, useWindowDimensions } from 'react-native'
import { font, space } from '../lib/theme'
import { BLOCK, BLOCK_NAME, SIDEWAYS_FULL, SIDE_WORDS, SWAP_WIDE, TOOL_NAMES, chipsFit, fullSays, sideWidths } from '../lib/twoSides'
import { THIRD_WORDS, threeLead } from '../lib/threeSides'
import Press from './Press'

/*
 * THE TWO SIDES' BUTTONS, IN THE APP'S TOP BAR: on a phone held on its side
 * (lib/twoSides phoneSidewaysOn) and, since 10 November 2026, on a big
 * screen too (`big`: an iPad on its side, the Duo opened, a tablet or a
 * fold sideways).
 *
 * Each side used to have a bar of its own under the app's on a big screen:
 * its name, Swap, Full screen. "The play and two sides buttons take up a
 * whole row on iPad" (Justin), and a phone on its side never had the height
 * for one. So the same buttons sit in the top bar itself, each side's over
 * its own side:
 *
 *   beside   the tool's name (tap for the list of what can go beside Play)
 *            and Full screen over the tool's side, Play's name over Play's,
 *            and Swap on the line between them.
 *   full     the tool fills the window: its name and Two sides.
 *   alone    Play alone on a big screen: Two sides, which brings back the
 *            tool that was beside it or, with none yet, opens the list.
 *            Nothing at all on a phone on its side, where Play's own
 *            buttons (the preset, Setlists, Edit, Tuner) open each tool.
 *
 * Play's own Full screen is not here: it is the tool's Done, which every
 * tool keeps in its own header.
 *
 * `frame` is the room under the bar as App measured it; the bar starts at
 * the same left edge, so the line between the sides is at the same place
 * in both, and Swap is centred on it. On a big screen the bar keeps its
 * version in front of these buttons, so where they start is measured
 * (`at`), and Swap still lands on the line.
 *
 * ON A BIG SCREEN THE WORDS ARE WHOLE WHERE THEY FIT: Full screen over a
 * side of 480 points or more, Full over a narrower one (the Duo's sides,
 * the tuner's narrow column), as on every phone (lib/twoSides fullSays).
 * And the side of the bar past Swap is shared with the account's photo, the
 * unit's pill, the speaker and Settings: where that leaves no room for a
 * side's buttons (an iPad with the tuner's column on that side), they sit
 * just before Swap instead of being cut (`moved`). And Swap itself is
 * never drawn under them: in the one tight case (that column, and Save up
 * beside the pill) it stops short of the line by what the bar lacks.
 */
export default function SidesLead({
  frame = null,
  tool = null,
  full = false,
  playOnRight = true,
  /* A big screen, not a phone on its side: the version before these, whole words where they fit, and Two sides with Play alone. */
  big = false,
  onName,
  onSwap,
  onFull,
  /* Play alone on a big screen: what Two sides does (App: the kept tool, or the list). */
  onTwo = null,
  /*
   * THREE ACROSS ON A VERY WIDE WINDOW (lib/threeSides; App asks its rule,
   * for an account it is open to). With two sides up and room for a third,
   * `onAdd` is what Add a side does (App opens the third side's list), and
   * the button sits with the first tool's own. With three up, `three` is
   * the tool the third side holds: then the bar is one row of the three
   * names in the order of the sides, the first tool's Full screen, and
   * Swap at its end; `onThird` opens the third side's list, where it can
   * be changed or closed. What gives way when the row is short is
   * lib/threeSides threeLead's: Full screen first, then Play's own name.
   * Null everywhere else, and the bar is what it was.
   */
  three = null,
  onAdd = null,
  onThird = null,
  /*
   * WHERE THE LINE BETWEEN THE SIDES HAS A HANDLE (components/SidesHandle;
   * the tidier Edit's, for an account it is open to, on a big screen): the
   * handle swaps, so Swap is not drawn here, one Swap and not two. Its room
   * is kept, empty, so each side's buttons stay over their own side. And
   * `share` is Play's share of the window from the last drag, so they
   * follow the line where it was dragged to. False and null everywhere
   * else.
   */
  handle = false,
  share = null
}) {
  const { fontScale = 1 } = useWindowDimensions()
  /* Where this row starts along the bar, past the version: measured on a big screen, nothing before it on a phone. */
  const [at, setAt] = useState(big ? VERSION_ROOM : 0)
  /* How much of the bar is left past Swap, measured on a big screen. */
  const [rest, setRest] = useState(null)
  /* How wide this row is, measured on a big screen: what the bar gives it, beside the photo, the pill, Save, the speaker and Settings. */
  const [row, setRow] = useState(null)
  /* Measured on every shape of this row, so Swap is on the line from the frame a tool opens in. */
  const measured = big
    ? {
        onLayout: (e) => {
          setAt(Math.round(e.nativeEvent.layout.x))
          setRow(Math.round(e.nativeEvent.layout.width))
        }
      }
    : null
  if (!tool) {
    if (!big) return null
    return (
      <View style={ROW} {...measured}>
        <Press label={SIDE_WORDS.two} height={HIGH} labelSize={font.small} onPress={onTwo} accessibilityLabel="Show two sides" style={CHIP} />
      </View>
    )
  }
  const knobs = tool === BLOCK
  const name = knobs ? BLOCK_NAME : TOOL_NAMES[tool] || ''
  const toolName = (
    <Press key="name" label={`${name} ▾`} height={HIGH} labelSize={font.small} onPress={() => onName?.('tool')} accessibilityLabel={`${name}. Choose what goes beside Play`} style={CHIP} />
  )
  if (full) {
    return (
      <View style={ROW} {...measured}>
        {toolName}
        <Press label={SIDE_WORDS.two} height={HIGH} labelSize={font.small} onPress={() => onFull?.(false)} accessibilityLabel="Show two sides" style={CHIP} />
      </View>
    )
  }
  if (three) {
    const thirdName = TOOL_NAMES[three] || ''
    const fills = fullSays(Math.floor((frame?.width || 0) / 3))
    const says = { first: `${name} ▾`, third: `${thirdName} ▾`, play: `${TOOL_NAMES.play} ▾` }
    const fits = threeLead({ room: row, ...says, full: knobs ? null : fills, swap: SIDE_WORDS.swap, letter: LETTER * font.small * (fontScale || 1), pad: CHIP_ROUND, gap: space.sm })
    const firstSide = [
      toolName,
      fits.full ? <Press key="full" label={fills} height={HIGH} labelSize={font.small} onPress={() => onFull?.(true)} accessibilityLabel={`${name} fills the screen`} style={CHIP} /> : null
    ]
    const thirdSide = (
      <Press key="third" label={says.third} height={HIGH} labelSize={font.small} onPress={onThird} accessibilityLabel={`${thirdName}, the third side. Choose what it holds, or close it`} style={CHIP} />
    )
    const playName = fits.play ? (
      <Press key="play" label={says.play} height={HIGH} labelSize={font.small} onPress={() => onName?.('play')} accessibilityLabel={`${TOOL_NAMES.play}. Choose what goes beside Play`} style={CHIP} />
    ) : null
    return (
      <View style={ROW} {...measured}>
        {/* In the order of the sides: Play at the end it has, the first tool at the far end, the third between them. */}
        {playOnRight ? firstSide : playName}
        {thirdSide}
        {playOnRight ? playName : firstSide}
        <Press key="swap" label={SIDE_WORDS.swap} height={HIGH} labelSize={font.small} onPress={onSwap} accessibilityLabel="Swap the sides: Play to the other end" style={[CHIP, { width: SWAP_WIDE }]} />
      </View>
    )
  }
  const widths = sideWidths({ width: frame?.width, left: frame?.left, right: frame?.right, playOnRight, tool, share })
  /* Where the line between the sides falls, from the bar's own left edge; the bar's padding, what is before this row and half of Swap come off the first half. */
  const line = playOnRight ? widths.tool : widths.play
  const reach = Math.max(0, line - space.lg - (big ? at : 0) - SWAP_WIDE / 2 - space.sm)
  /* And on a big screen never past what the bar gives this row: with the tuner's column on the far side and Save up beside the pill, Swap stops short of the line sooner than it is drawn under the pill. */
  const first = big && row !== null ? Math.min(reach, Math.max(0, row - SWAP_WIDE - space.sm)) : reach
  const fills = big ? fullSays(widths.tool) : SIDEWAYS_FULL
  const toolSide = [
    toolName,
    /* A block's knobs never fill the window: Play is where the next block is held. */
    knobs ? null : <Press key="full" label={fills} height={HIGH} labelSize={font.small} onPress={() => onFull?.(true)} accessibilityLabel={`${name} fills the screen`} style={CHIP} />,
    /* Room for a third side (lib/threeSides), and none open yet: its way in, with the first tool's own buttons. */
    onAdd ? <Press key="add" label={THIRD_WORDS.add} height={HIGH} labelSize={font.small} onPress={onAdd} accessibilityLabel="Add a side: a second tool beside Play" style={CHIP} /> : null
  ]
  const playSide = (
    <Press key="play" label={`${TOOL_NAMES.play} ▾`} height={HIGH} labelSize={font.small} onPress={() => onName?.('play')} accessibilityLabel={`${TOOL_NAMES.play}. Choose what goes beside Play`} style={CHIP} />
  )
  const before = playOnRight ? toolSide : playSide
  const after = playOnRight ? playSide : toolSide
  /* What the buttons past Swap say, for whether they fit what the bar has left there (a big screen only). */
  const afterSays = playOnRight ? [`${TOOL_NAMES.play} ▾`] : [`${name} ▾`, knobs ? null : fills]
  /* And Add a side with them, where it is offered and the tool's buttons are the ones past Swap. */
  const afterAll = onAdd && !playOnRight ? [...afterSays, THIRD_WORDS.add] : afterSays
  const moved = big && rest !== null && !chipsFit({ room: rest, labels: afterAll, letter: LETTER * font.small * (fontScale || 1), pad: CHIP_ROUND, gap: space.sm })
  return (
    <View style={ROW} {...measured}>
      <View style={[moved ? HALF_APART : HALF, { width: first }]}>
        {moved ? <View style={HALF}>{before}</View> : before}
        {moved ? <View style={HALF}>{after}</View> : null}
      </View>
      {handle ? (
        <View style={{ width: SWAP_WIDE }} />
      ) : (
        <Press label={SIDE_WORDS.swap} height={HIGH} labelSize={font.small} onPress={onSwap} accessibilityLabel="Swap the two sides" style={[CHIP, { width: SWAP_WIDE }]} />
      )}
      {big ? (
        /* All the bar has left past Swap, measured, so the buttons there are moved before they are cut. */
        <View style={REST_ALL} onLayout={(e) => setRest(Math.round(e.nativeEvent.layout.width))}>
          {moved ? null : after}
        </View>
      ) : (
        <View style={REST}>{after}</View>
      )}
    </View>
  )
}

/* Under a thumb's 44 on purpose: the bar is 48, and Press reaches 44 by its own hit slop. */
const HIGH = 36
const CHIP = { paddingHorizontal: space.sm, paddingVertical: 2 }
const ROW = { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm }
const HALF = { flexDirection: 'row', alignItems: 'center', gap: space.sm }
/* The first half with the far side's buttons moved into it: its own at the start, theirs at the end, beside Swap. */
const HALF_APART = { ...HALF, justifyContent: 'space-between' }
const REST = { flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm }
const REST_ALL = { flex: 1, minWidth: 0, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: space.sm }
/* The version's room before this row on a big screen, until it is measured: "v1.90.21" in the bar's small type, and the gap after it. */
const VERSION_ROOM = 72
/* A letter of a button's words, as a share of its type size, erring wide; and what is round the words: the padding, the border, and slack. */
const LETTER = 0.62
const CHIP_ROUND = 2 * space.sm + 2 + 6
