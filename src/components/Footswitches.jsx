import { useEffect, useRef, useState } from 'react'
import { fcModel, fcSwitch } from '../lib/forgefx'
import {
  FC_BUSY_WARNING,
  FC_NOT_YET,
  describeSwitch,
  fcGeometry,
  layoutName,
  lightWords,
  readView
} from '../../shared/footswitches.mjs'

/**
 * What the footswitches do — read-only, one view at a time.
 *
 * "See what the footswitches do." Tap, hold, the label on the little screen
 * when one has been typed in, and the colour of the light. Nothing here
 * changes a switch.
 *
 * Reads only while its fold is open. The panel sits inside a <Section>, which
 * is a <details> that is always mounted, so being drawn is not being looked
 * at: it listens for the fold opening, reads the view on screen then, and
 * stops asking when the fold closes. A view already read is kept for as long
 * as the screen is, so opening it again costs the unit nothing; "Read again"
 * is the one way to ask twice. See shared/footswitches.mjs for why.
 */
export default function Footswitches() {
  const root = useRef(null)
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState(null)
  const [layout, setLayout] = useState(0)
  const [view, setView] = useState(0)
  /* `${layout}:${view}` → { states: [...], error, complete } */
  const [seen, setSeen] = useState({})
  const [reading, setReading] = useState(null)
  const [again, setAgain] = useState(0)
  const seenRef = useRef(seen)
  seenRef.current = seen
  const askedAgain = useRef(0)

  /* Opened when its fold is. Outside a fold, it counts as open. */
  useEffect(() => {
    const fold = root.current?.closest('details')
    if (!fold) {
      setOpen(true)
      return undefined
    }
    const said = () => setOpen(fold.open)
    said()
    fold.addEventListener('toggle', said)
    return () => fold.removeEventListener('toggle', said)
  }, [])

  const key = `${layout}:${view}`

  useEffect(() => {
    if (!open) return undefined
    const forced = askedAgain.current !== again
    if (seenRef.current[key]?.complete && !forced) return undefined
    askedAgain.current = again
    let stop = false
    ;(async () => {
      let m = model
      if (!m) {
        try {
          const got = await fcModel()
          m = got && !got.error ? got : null
        } catch {
          m = null
        }
        if (stop) return
        if (!m) {
          setSeen((prev) => ({ ...prev, [key]: { states: [], error: 'The unit didn’t say what its switches can do.', complete: false } }))
          return
        }
        setModel(m)
      }
      const { switches } = fcGeometry(m)
      setSeen((prev) => ({ ...prev, [key]: { states: [], error: null, complete: false } }))
      setReading({ key, done: 0, of: switches })
      const result = await readView(fcSwitch, {
        layout,
        view,
        switches,
        stopped: () => stop,
        onSwitch: (i, state) => {
          if (stop) return
          setSeen((prev) => ({ ...prev, [key]: { states: [...(prev[key]?.states || []), state], error: null, complete: false } }))
          setReading({ key, done: i + 1, of: switches })
        }
      })
      if (stop) return
      setSeen((prev) => ({
        ...prev,
        [key]: { states: result.states, error: result.error, complete: !result.error && !result.stopped }
      }))
      setReading(null)
    })()
    return () => {
      stop = true
      setReading(null)
    }
    // `model` is read, not watched: loading it must not start a second read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, again])

  const geo = fcGeometry(model)
  const shown = seen[key]
  const busy = !!reading

  return (
    <section className="footswitches" ref={root}>
      <p className="hint">{FC_BUSY_WARNING}</p>

      <div className="mod-grid">
        <label className="mod-field">
          <span className="diff-label">Layout</span>
          <select value={layout} onChange={(e) => setLayout(Number(e.target.value))}>
            {Array.from({ length: geo.layouts }, (_, i) => (
              <option key={i} value={i}>
                {layoutName(i, geo.layouts)}
              </option>
            ))}
          </select>
        </label>
        <label className="mod-field">
          <span className="diff-label">View</span>
          <select value={view} onChange={(e) => setView(Number(e.target.value))}>
            {Array.from({ length: geo.views }, (_, i) => (
              <option key={i} value={i}>
                View {i + 1}
              </option>
            ))}
          </select>
        </label>
      </div>

      {reading ? (
        <p className="progress mono">
          Reading switch {Math.min(reading.done + 1, reading.of)} of {reading.of}…
        </p>
      ) : null}

      {shown?.states?.length ? (
        <div className="fc-switches">
          {shown.states.map((state, i) => {
            const sw = describeSwitch(state, model)
            return (
              <div className="fc-switch" key={i}>
                <span className="silk-label">Switch {sw.number ?? i + 1}</span>
                {sw.unread ? (
                  <span className="fc-line">The unit didn’t answer for this one.</span>
                ) : (
                  <>
                    <span className="fc-line">
                      <span className="fc-when">Tap</span> {sw.tap.action}
                      {sw.tap.label ? <span className="fc-label mono"> “{sw.tap.label}”</span> : null}
                    </span>
                    <span className="fc-line">
                      <span className="fc-when">Hold</span> {sw.hold.action}
                      {sw.hold.label ? <span className="fc-label mono"> “{sw.hold.label}”</span> : null}
                    </span>
                    <span className="fc-line fc-light-line">
                      {sw.light?.hex ? (
                        <span className="fc-light" style={{ background: sw.light.hex }} aria-hidden="true" />
                      ) : null}
                      {lightWords(sw.light)}
                    </span>
                  </>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      {shown?.error ? <p className="hint">Couldn’t read the switches: {shown.error}</p> : null}

      {shown && !busy ? (
        <div className="history-actions">
          <button className="chip" onClick={() => setAgain((n) => n + 1)}>
            Read again
          </button>
        </div>
      ) : null}

      <p className="hint">{FC_NOT_YET}</p>
    </section>
  )
}
