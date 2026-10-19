import { useEffect, useState } from 'react'

import { COLOURS_NOTICE } from '../lib/colourPage'
import { coloursNoticeSeen, markColoursNotice } from '../lib/coach'
import { tick } from '../lib/feedback'
import { isFractalRemoteLook, looksLoaded } from '../lib/looks'
import Note from './Note'

/**
 * WHERE THE UNIT'S COLOURS ARE, SAID ONCE, ON PLAY.
 *
 * "Can we change it so the fractal remote colors scene is the default? But
 * then the first time the app loads, also let people know that they can
 * change the theme to match their actual unit in settings?" The tiles start
 * in the app's own colours (Fractal Remote) now, and Match my unit is a look
 * on Settings → Colors. Pressing the words opens that page (`onOpen`, from
 * App through Stage); the cross puts the line away.
 *
 * For a first run too, after the startup card and the walkthrough, which App
 * draws in place of Play. Only to somebody wearing Fractal Remote: somebody
 * who chose another look has found the page already, so the line is put
 * away for him unsaid, the moment it would have been his turn. And not
 * before the phone's storage has said which look that is (looksLoaded):
 * until then every phone reads as wearing the default.
 *
 * Remembered the moment it is shown rather than when it is put away, like the
 * channel tip: one launch with it at the top of Play, never a line that
 * stays above the preset name for good because nobody pressed its cross.
 * Hidden until the phone's storage has answered, so it never flashes up for
 * somebody who has seen it.
 *
 * AND IT WAITS ITS TURN, as the browser's does: last of Play's one-time
 * notes, never beside another (`waiting`, from Stage). On a 320 by 568 phone
 * the line before it stood under the demo card and pushed Tuner, Edit and
 * Tap off the bottom of Play. Not asked for, and so not remembered, while
 * another note is up; and once shown it steps aside for one that comes up
 * after it, and is back when that one goes. One line at 320 wide (lib/
 * colourPage COLOURS_NOTICE), where the line before it took two.
 *
 * NOR WHILE ONE BEFORE IT HAS NOT ANSWERED (`unanswered`: the quick tip on
 * holding a block, or the watch's sheet, still waiting on the phone's
 * storage). Found in review on the demo AM4: the demo card put away, this
 * line's storage and the quick tip's were asked in the same moment, this one
 * answered first and was remembered as said, and the tip took the turn
 * before it was ever drawn. A Try it with no hold after it, or the app
 * closed under the tip, and the line was never seen and never came back. So
 * it is not asked until they have answered, it is not drawn while one of
 * them still might, and it is remembered only once it has been drawn. Once
 * said, a question still open before it does not take it down again: only a
 * note that is actually up does.
 */
export default function ColoursNotice({ waiting = false, unanswered = false, onOpen }) {
  const [due, setDue] = useState(launch === 'showing')

  useEffect(() => {
    if (launch === 'showing') {
      setDue(true)
      return undefined
    }
    if (launch === 'gone' || waiting || unanswered) return undefined
    let alive = true
    coloursNoticeSeen().then((v) => {
      if (alive && !v) setDue(true)
    })
    return () => {
      alive = false
    }
  }, [waiting, unanswered])

  /* Which look is worn, once the phone's storage has said (App repaints from its root when it does). */
  const known = looksLoaded()
  const elsewhere = known && !isFractalRemoteLook()
  const drawn = due && known && !elsewhere && !waiting && (launch === 'showing' || !unanswered)

  /* Remembered the moment it is on the screen, and not a moment before. */
  useEffect(() => {
    if (!drawn || launch !== null) return
    markColoursNotice()
    launch = 'showing'
  }, [drawn])

  /* Another look, chosen: he has been to the page. Put away for good, at its turn or once said. */
  useEffect(() => {
    if (!due || !elsewhere || launch === 'gone') return
    markColoursNotice()
    launch = 'gone'
    setDue(false)
  }, [due, elsewhere])

  if (!drawn) return null

  const away = () => {
    tick()
    launch = 'gone'
    setDue(false)
  }

  return (
    <Note
      onPress={() => {
        away()
        onOpen?.()
      }}
      onDismiss={away}
    >
      {COLOURS_NOTICE}
    </Note>
  )
}

/*
 * THIS LAUNCH'S ANSWER, kept outside the screen, like the browser's visit.
 * Play is drawn afresh when somebody comes back to it from Settings or the
 * preset list, and a line marked seen the first time it was drawn would be
 * gone by the time anybody looked. So it stays for the launch once shown,
 * until it is pressed or its cross. The next launch, it is seen.
 */
let launch = null
