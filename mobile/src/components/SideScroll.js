import { ScrollView } from 'react-native'
import { holdSideways } from '../lib/edge-back'

/**
 * A row that scrolls sideways, and keeps its drags from the back gesture.
 *
 * "On the edit screen when swiping from left to right to scroll the blocks it
 * goes back to the Home Screen." Swiping left to right is exactly how a
 * sideways row is scrolled back to its start, and it is exactly the back
 * gesture's direction. The row is touched first, so it says so then, and
 * EdgeBack stands aside until the finger lifts. See lib/edge-back.js.
 *
 * Every sideways ScrollView in the app is one of these; a test holds that,
 * so a new row cannot quietly bring the bug back.
 */
export default function SideScroll({ onTouchStart, ...rest }) {
  return (
    <ScrollView
      horizontal
      {...rest}
      onTouchStart={(e) => {
        holdSideways()
        onTouchStart?.(e)
      }}
    />
  )
}
