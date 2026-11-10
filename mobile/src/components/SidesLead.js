import { View } from 'react-native'
import { font, space } from '../lib/theme'
import { BLOCK, BLOCK_NAME, SIDEWAYS_FULL, SIDE_WORDS, TOOL_NAMES, sideWidths } from '../lib/twoSides'
import Press from './Press'

/*
 * THE TWO SIDES' BARS, IN THE APP'S TOP BAR, on a phone held on its side
 * (lib/twoSides phoneSidewaysOn).
 *
 * On a tablet each side has a bar of its own under the app's (components/
 * Sides SideBar): its name, Swap, Full screen. A phone on its side is about
 * 330 points tall under the top bar, and a second row of bars would take a
 * sixth of that from the tiles. So there the same buttons sit in the top
 * bar itself, each side's over its own half:
 *
 *   beside   the tool's name (tap for the list of what can go beside Play)
 *            and Full over the tool's half, Play's name over Play's, and
 *            Swap on the line between them.
 *   full     the tool fills the window: its name and Two sides.
 *
 * Play's own Full screen is not here: it is the tool's Done, which every
 * tool keeps in its own header. With Play alone nothing is drawn at all,
 * since Play's own buttons (the preset, Setlists, Edit, Tuner) open each
 * tool beside it.
 *
 * `frame` is the room under the bar as App measured it; the bar starts at
 * the same left edge, so the line between the sides is at the same place
 * in both, and Swap is centred on it.
 */
export default function SidesLead({ frame = null, tool = null, full = false, playOnRight = true, onName, onSwap, onFull }) {
  if (!tool) return null
  const knobs = tool === BLOCK
  const name = knobs ? BLOCK_NAME : TOOL_NAMES[tool] || ''
  const toolName = (
    <Press key="name" label={`${name} ▾`} height={HIGH} labelSize={font.small} onPress={() => onName?.('tool')} accessibilityLabel={`${name}. Choose what goes beside Play`} style={CHIP} />
  )
  if (full) {
    return (
      <View style={ROW}>
        {toolName}
        <Press label={SIDE_WORDS.two} height={HIGH} labelSize={font.small} onPress={() => onFull?.(false)} accessibilityLabel="Show two sides" style={CHIP} />
      </View>
    )
  }
  const widths = sideWidths({ width: frame?.width, left: frame?.left, right: frame?.right, playOnRight, tool })
  /* Where the line between the sides falls, from the bar's own left edge; the bar's padding and half of Swap come off the first half. */
  const line = playOnRight ? widths.tool : widths.play
  const first = Math.max(0, line - space.lg - SWAP_WIDE / 2 - space.sm)
  const toolSide = [
    toolName,
    /* A block's knobs never fill the window: Play is where the next block is held. */
    knobs ? null : <Press key="full" label={SIDEWAYS_FULL} height={HIGH} labelSize={font.small} onPress={() => onFull?.(true)} accessibilityLabel={`${name} fills the screen`} style={CHIP} />
  ]
  const playSide = (
    <Press key="play" label={`${TOOL_NAMES.play} ▾`} height={HIGH} labelSize={font.small} onPress={() => onName?.('play')} accessibilityLabel={`${TOOL_NAMES.play}. Choose what goes beside Play`} style={CHIP} />
  )
  return (
    <View style={ROW}>
      <View style={[HALF, { width: first }]}>{playOnRight ? toolSide : playSide}</View>
      <Press label={SIDE_WORDS.swap} height={HIGH} labelSize={font.small} onPress={onSwap} accessibilityLabel="Swap the two sides" style={[CHIP, { width: SWAP_WIDE }]} />
      <View style={REST}>{playOnRight ? playSide : toolSide}</View>
    </View>
  )
}

/* Under a thumb's 44 on purpose: the bar is 48, and Press reaches 44 by its own hit slop. */
const HIGH = 36
const SWAP_WIDE = 64
const CHIP = { paddingHorizontal: space.sm, paddingVertical: 2 }
const ROW = { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm }
const HALF = { flexDirection: 'row', alignItems: 'center', gap: space.sm }
const REST = { flexShrink: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm }
