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
 */
export default function ColoursNotice({ waiting = false }) {
  const [shown, setShown] = useState(launch === 'showing')

  useEffect(() => {
    if (launch === 'showing') {
      setShown(true)
      return undefined
    }
    if (waiting) return undefined
    let alive = true
    coloursNoticeSeen().then((v) => {
      if (!alive || v) return
      markColoursNotice()
      launch = 'showing'
      setShown(true)
    })
    return () => {
      alive = false
    }
  }, [waiting])

  if (!shown || waiting) return null

  return (
    <Note
      onDismiss={() => {
        tick()
        launch = 'gone'
        setShown(false)
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
