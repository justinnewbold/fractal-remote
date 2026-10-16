import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { demoSentence } from '../lib/demoUnits'
import { useDemo, useDemoUnit } from '../lib/demo'
import { tick } from '../lib/feedback'
import Note from './Note'

/**
 * THE DEMO'S VP4 SAYS ITS SENTENCE ON PLAY, ONCE, as the browser's does.
 *
 * Somebody new who picks VP4 in the walkthrough went from "Which unit should
 * we simulate?" straight to Play, and Play showed a working tuner, Tap 120
 * and HOLD TO SWITCH CHANNELS, none of which a real VP4 does from the app
 * yet. The sentence that says so (VP4_DEMO) was only in the Demo Unit sheet
 * and in Settings, so the phone's main way in never showed it, while the
 * browser puts it over Play the first time the demo is a VP4 (its
 * demoNoteSeen, kept for a VP4 apart from the other units).
 *
 * So the same here: while the demo is a VP4, the sentence sits at the top of
 * Play until its cross is pressed, and then never again. Kept on the phone
 * under a key of its own, so putting it away says nothing about any other
 * unit. Hidden until the phone's storage has answered, so it never flashes
 * up and away for somebody who put it away last week. Nothing here for the
 * other four units: the phone says their sentence where it always has.
 */
export const VP4_DEMO_NOTE_KEY = 'fractal.demo.note.vp4'

export default function Vp4DemoNote() {
  const demo = useDemo()
  const unit = useDemoUnit()
  const here = demo && unit === 'vp4'
  const [seen, setSeen] = useState(true)

  useEffect(() => {
    if (!here) return undefined
    let alive = true
    AsyncStorage.getItem(VP4_DEMO_NOTE_KEY)
      .then((v) => alive && setSeen(v === 'seen'))
      .catch(() => alive && setSeen(false))
    return () => {
      alive = false
    }
  }, [here])

  if (!here || seen) return null

  const put = () => {
    tick()
    setSeen(true)
    AsyncStorage.setItem(VP4_DEMO_NOTE_KEY, 'seen').catch(() => {})
  }

  return (
    <Note tone="warn" onDismiss={put}>
      {demoSentence('vp4')}
    </Note>
  )
}
