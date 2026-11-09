import { useWindowDimensions } from 'react-native'

import { font, space, TAP } from './theme'
import { roomFor } from './tabletScale'

/* The theme's own sizes, the ones a phone is drawn with: lib/tabletScale grows them on a tablet. */
const BASE = { font, space, TAP }

/**
 * The room the window gives the walkthrough and the Unlock page
 * (lib/tabletScale roomFor): on a phone the theme's sizes as they are, on a
 * tablet the same sizes grown, with a centred column and a wider sheet.
 * Read off the window every time it changes, so an iPad dragged into a
 * narrow strip beside another app goes back to the phone's layout.
 */
export function useRoom() {
  const { width, height } = useWindowDimensions()
  return roomFor(width, height, BASE)
}
