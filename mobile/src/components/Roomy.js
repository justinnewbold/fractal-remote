import { font } from '../lib/theme'
import { grownNote, grownPress } from '../lib/tabletScale'
import { useRoom } from '../lib/useRoom'
import Note from './Note'
import Press from './Press'

/*
 * THE APP'S OWN BUTTON AND NOTE, GROWN ON A TABLET, for the two screens that
 * fill an iPad: the walkthrough (screens/Onboarding.js) and the Unlock page
 * (screens/Paywall.js), which take these in Press's and Note's names.
 *
 * On a phone each hands its props on untouched, the very same object, so
 * the button and the note are drawn exactly as they always were. On a
 * tablet the button is taller with bigger words, and the note's words are
 * bigger (lib/tabletScale grownPress, grownNote). Nothing else about either
 * changes: the words, the tone, what a press does.
 */
export function RoomPress(props) {
  const room = useRoom()
  return <Press {...grownPress(props, room, { bodySize: font.body })} />
}

export function RoomNote(props) {
  const room = useRoom()
  return <Note {...grownNote(props, room)} />
}
