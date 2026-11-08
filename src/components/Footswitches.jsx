import { useEffect, useRef, useState } from 'react'
import { fcCurrent, fcModel, fcNames, fcSwitch, unitCapabilities } from '../lib/forgefx'
import {
  FC_BUSY_WARNING,
  FC_NOT_YET,
  FC_PICKS_SOME,
  currentOf,
  describeSwitch,
  fcGeometry,
  fcKnowsCurrent,
  fcKnowsNames,
  fcSaysPicks,
  layoutLabel,
  lightWords,
  namesOf,
  nowWords,
  readView,
  viewLabel
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
 *
 * Where the computer has the reads (fcKnowsCurrent, fcKnowsNames), it first
 * asks which layout and view are on now and opens there, marked "on now",
 * and once the first view has been read it asks the layout names, once.
 * A computer without them is asked neither, and the panel is as it was.
 */
export default function Footswitches() {
  const root = useRef(null)
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState(null)
  const [layout, setLayout] = useState(0)
  const [view, setView] = useState(0)
  const [caps] = useState(() => unitCapabilities())
  const knowsNow = fcKnowsCurrent(caps)
  const knowsNames = fcKnowsNames(caps)
  /* undefined while the unit is still being asked; null when it did not say. */
  const [now, setNow] = useState(knowsNow ? undefined : null)
  const [names, setNames] = useState(null)
  const [naming, setNaming] = useState(false)
  const picked = useRef(false)
  const namesAsked = useRef(false)
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
  const asking = now === undefined

  /* Which layout and view are on now: asked once, when the panel first opens, before any switch. */
  useEffect(() => {
    if (!open || !asking) return undefined
    let stop = false
    ;(async () => {
      let got = null
      try {
        got = currentOf(await fcCurrent())
      } catch {
        got = null
      }
      if (stop) return
      if (got && !picked.current) {
        setLayout(got.layout)
        setView(got.view)
      }
      setNow(got)
    })()
    return () => {
      stop = true
    }
  }, [open, asking])

  useEffect(() => {
    if (!open) return undefined
    /* Not before the unit has said which layout is on, so the first view read is the right one. */
    if (asking) return undefined
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
      /* The layout names, once, after the first view: about a hundred questions. Kept even if
         the view changes meanwhile — they are the same names whatever is on screen. */
      if (knowsNames && !namesAsked.current && !result.error && !result.stopped) {
        namesAsked.current = true
        setNaming(true)
        let got = null
        try {
          got = namesOf(await fcNames(), fcGeometry(m).layouts)
        } catch {
          got = null
        }
        setNaming(false)
        if (got) setNames(got)
      }
    })()
    return () => {
      stop = true
      setReading(null)
    }
    // `model` is read, not watched: loading it must not start a second read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, again, asking])

  const geo = fcGeometry(model)
  const shown = seen[key]
  const busy = !!reading

  return (
    <section className="footswitches" ref={root}>
      <p className="hint">{FC_BUSY_WARNING}</p>

      {now ? <p className="hint fc-now">{nowWords(now, { layouts: geo.layouts, names })}</p> : null}

      <div className="mod-grid">
        <label className="mod-field">
          <span className="diff-label">Layout</span>
          <select
            value={layout}
            onChange={(e) => {
              picked.current = true
              setLayout(Number(e.target.value))
            }}
          >
            {Array.from({ length: geo.layouts }, (_, i) => (
              <option key={i} value={i}>
                {layoutLabel(i, { layouts: geo.layouts, names, now })}
              </option>
            ))}
          </select>
        </label>
        <label className="mod-field">
          <span className="diff-label">View</span>
          <select
            value={view}
            onChange={(e) => {
              picked.current = true
              setView(Number(e.target.value))
            }}
          >
            {Array.from({ length: geo.views }, (_, i) => (
              <option key={i} value={i}>
                {viewLabel(i, { layout, now })}
              </option>
            ))}
          </select>
        </label>
      </div>

      {asking && open ? <p className="progress mono">Asking which layout is on…</p> : null}

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
                      <span className="fc-when">Tap</span> {sw.tap.pick || sw.tap.action}
                      {sw.tap.label ? <span className="fc-label mono"> “{sw.tap.label}”</span> : null}
                    </span>
                    <span className="fc-line">
                      <span className="fc-when">Hold</span> {sw.hold.pick || sw.hold.action}
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

      {naming ? <p className="progress mono">Reading the layout names…</p> : null}

      <p className="hint">{fcSaysPicks(shown?.states) ? FC_PICKS_SOME : FC_NOT_YET}</p>
    </section>
  )
}
