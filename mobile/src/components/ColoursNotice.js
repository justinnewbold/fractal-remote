import { useEffect, useState } from 'react'

import { COLOURS_NOTICE } from '../lib/colourPage'
import { coloursNoticeSeen, markColoursNotice } from '../lib/coach'
import { tick } from '../lib/feedback'
import Note from './Note'

/**
 * THE COLOURS CHANGED, SAID ONCE, ON PLAY.
 *
 * "I feel like the button and effects pedal colors dont match the colors on
 * real fractal units." They match now, which means every tile on the stage
 * came back from one update a different colour. A player who had the old
 * ones in his eye is told why, and where to go — Settings → Colours, where
 * Fractal Remote is the old look exactly, one tap away.
 *
 * Remembered the moment it is shown rather than when it is put away, like the
 * channel tip: one launch with it at the top of Play, never a line that
 * stays above the preset name for good because nobody pressed its cross.
 * Hidden until the phone's storage has answered, so it never flashes up for
 * somebody who has seen it. Nothing here for a first run (see lib/coach).
 *
 * AND IT WAITS ITS TURN, as the browser's does: last of Play's one-time
 * notes, never beside another (`waiting`, from Stage). On a 320 by 568 phone
 * it stood under the demo card and pushed Tuner, Edit and Tap off the
 * bottom of Play. Not asked for, and so not remembered, while another note
 * is up; and once shown it steps aside for one that comes up after it, and
 * is back when that one goes.
 *
 * NOR WHILE ONE BEFORE IT HAS NOT ANSWERED (`unanswered`: the quick tip on
 * holding a block, or the watch's sheet, still waiting on the phone's
 * storage). Found in review on the demo AM4: the demo card put away, this
 * line's storage and the quick tip's were asked in the same moment, this one
 * answered first and was remembered as said, and the tip took the turn
 * before it was ever drawn. A Try it with no hold after it, or the app
 * closed under the tip, and "Colours now match your unit" was never seen and
 * never came back. So it is not asked until they have answered, it is not
 * drawn while one of them still might, and it is remembered only once it has
 * been drawn. Once said, a question still open before it does not take it
 * down again: only a note that is actually up does.
 */
export default function ColoursNotice({ waiting = false, unanswered = false }) {
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

  const drawn = due && !waiting && (launch === 'showing' || !unanswered)

  /* Remembered the moment it is on the screen, and not a moment before. */
  useEffect(() => {
    if (!drawn || launch !== null) return
    markColoursNotice()
    launch = 'showing'
  }, [drawn])

  if (!drawn) return null

  return (
    <Note
      onDismiss={() => {
        tick()
        launch = 'gone'
        setDue(false)
      }}
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
 * until its cross. The next launch, it is seen.
 */
let launch = null
