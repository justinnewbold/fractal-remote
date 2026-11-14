/*
 * TONE3000 IN A HELD NAM BLOCK'S POP-UP.
 *
 * "I want it in the app in a few places. One is if they hold a nam block it
 * pulls up the quick edit screen on top of it have it say tone 3000 where
 * they can click on it and browse tones preview them and then download them
 * directly and then it'll take them back to that screen so it's very
 * streamlined." (Justin, 14 November 2026, with a picture of NAM 2's quick
 * edit.)
 *
 * Three small things, so Play's own file (screens/Stage) holds none of
 * TONE3000's: whether the block held is offered it (`useTone3000Door`), the
 * button over its knobs (`Tone3000Door`), and the page that takes the
 * knobs' place in the same pop-up (`Tone3000InPop`), which is the Developer
 * page's own (components/Tone3000Test) told which block it was opened from.
 *
 * IN THE SAME POP-UP, not a second one over it: the sheet keeps its title
 * (the block's name) and its way out, nothing is drawn over anything, and
 * "back to that screen" is the page giving way to the knobs it replaced.
 * The channels at the pop-up's foot are put away while it is up: a channel
 * tapped from under a list of tones would close the pop-up.
 *
 * THE SAME THREE ARE THE CAPTURE LIST'S IN EDIT (components/CapturePicker):
 * "Also want it on the capture screen when I can they see the ones they've
 * already downloaded but then they can also click tone 3000 from that" (the
 * same day). There the button is over the captures on the unit and the page
 * takes the list's place in its sheet.
 *
 * WHERE: lib/tone3000Quick. His account first: lib/useTone3000Quick.
 */
import { useState } from 'react'
import { View } from 'react-native'

import { color, space } from '../lib/theme'
import { idOf } from '../lib/device'
import { namNumber, tone3000QuickFor } from '../lib/tone3000Quick'
import { BACK_TO_CAPTURES, backToKnobs, quickSub, T3K_QUICK } from '../lib/tone3000Words'
import { useTone3000Quick } from '../lib/useTone3000Quick'
import Press from './Press'
import Tone3000Test from './Tone3000Test'

/** For the block held (or none): `{ offered, id, n }`, the block's effect id and which NAM it is. */
export function useTone3000Door(block) {
  const allowed = useTone3000Quick()
  const id = block ? idOf(block) : null
  const offered = tone3000QuickFor(allowed, block, id)
  return { offered, id: offered ? id : null, n: offered ? namNumber(id) : 0 }
}

/**
 * The button over the block's knobs: TONE3000's name, and in a line what it
 * is for. Its words are in the live colour: over the captures on the unit
 * it is the same size and shape as a capture's row, and in plain ink it
 * read as one more capture, called TONE3000.
 */
export function Tone3000Door({ n, onPress }) {
  return <Press label={T3K_QUICK} sub={quickSub(n)} tone="live" inkColor={color.live} height={56} onPress={onPress} />
}

/**
 * The page, in the knobs' place, or (`from` 'captures') in the place of the
 * list of captures on the unit (components/CapturePicker). `onBack(line)`
 * puts what it replaced back: with what the block said it is playing after
 * a Get, with nothing from Back. `onPointed(slot)` is the page's own
 * (components/Tone3000Test): each time the unit named what the block is on.
 */
export function Tone3000InPop({ id, n, onBack, from = 'knobs', onPointed = null }) {
  /* While a capture is being fetched or sent the way back waits, as the page's own Back does: leaving then takes its lines away, and a Get could not finish by playing it. */
  const [working, setWorking] = useState(false)
  return (
    <View style={{ gap: space.md }}>
      <Press label={from === 'captures' ? BACK_TO_CAPTURES : backToKnobs(n)} height={44} disabled={working} onPress={() => onBack('')} />
      <Tone3000Test block={id} held backTo={from} onDone={(line) => onBack(line || '')} onWorking={setWorking} onPointed={onPointed} />
    </View>
  )
}
