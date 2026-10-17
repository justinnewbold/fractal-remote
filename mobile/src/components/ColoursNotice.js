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
 */
export default function ColoursNotice() {
  const [seen, setSeen] = useState(true)

  useEffect(() => {
    let alive = true
    coloursNoticeSeen().then((v) => {
      if (!alive || v) return
      markColoursNotice()
      setSeen(false)
    })
    return () => {
      alive = false
    }
  }, [])

  if (seen) return null

  return (
    <Note
      onDismiss={() => {
        tick()
        setSeen(true)
      }}
    >
      {COLOURS_NOTICE}
    </Note>
  )
}
