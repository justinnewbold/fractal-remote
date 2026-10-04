import { useCallback, useRef } from 'react'
import { useScreenClick } from '../lib/metronome'

/**
 * The browser's half of the metronome: a beep (useScreenClick) and a frame
 * round the page that lights on every beat. Pressing nothing — it is drawn
 * over the page with pointer-events off.
 */
export default function MetronomeBeat({ bpm }) {
  const frame = useRef(null)
  const onBeat = useCallback(() => {
    const el = frame.current
    if (!el) return
    el.classList.remove('metronome-beat-on')
    void el.offsetWidth
    el.classList.add('metronome-beat-on')
  }, [])
  useScreenClick(bpm, onBeat)
  return <div ref={frame} className="metronome-beat" aria-hidden="true" />
}
