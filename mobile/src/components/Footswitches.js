import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { color, font, space } from '../lib/theme'
import { glassCard } from '../lib/glass'
import { fcCurrent, fcModel, fcNames, fcSwitch } from '../lib/device'
import { useRig } from '../lib/rig'
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
} from '../lib/footswitches'
import Note from './Note'
import Press from './Press'

const ofCapabilities = (s) => s.capabilities

/**
 * WHAT EACH FOOTSWITCH DOES — the browser's Footswitches panel, on the phone.
 *
 * One layout and view at a time, one switch at a time, at the pace
 * lib/footswitches sets: reading a switch is about thirty questions to the
 * unit, so the page reads only while it is open and says so first. Read-only.
 *
 * Where the computer has the reads (lib/footswitches fcKnowsCurrent,
 * fcKnowsNames), the page first asks which layout and view are on now and
 * opens there, marked "on now", and once the first view has been read asks
 * the layout names, once. A computer without them is asked neither, and the
 * page is as it was.
 */
export default function Footswitches() {
  const caps = useRig(ofCapabilities)
  const [knowsNow] = useState(() => fcKnowsCurrent(caps))
  const [knowsNames] = useState(() => fcKnowsNames(caps))
  const [model, setModel] = useState(null)
  const [layout, setLayout] = useState(0)
  const [view, setView] = useState(0)
  /* undefined while the unit is still being asked; null when it did not say. */
  const [now, setNow] = useState(knowsNow ? undefined : null)
  const [names, setNames] = useState(null)
  const [naming, setNaming] = useState(false)
  const picked = useRef(false)
  const namesAsked = useRef(false)
  const [seen, setSeen] = useState({})
  const [reading, setReading] = useState(null)
  const [again, setAgain] = useState(0)
  const seenRef = useRef(seen)
  seenRef.current = seen
  const askedAgain = useRef(0)
  const key = `${layout}:${view}`
  const asking = now === undefined

  /* Which layout and view are on now: asked once, before any switch. */
  useEffect(() => {
    if (!asking) return undefined
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
  }, [asking])

  useEffect(() => {
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
      setReading({ done: 0, of: switches })
      const result = await readView(fcSwitch, {
        layout,
        view,
        switches,
        stopped: () => stop,
        onSwitch: (i, state) => {
          if (stop) return
          setSeen((prev) => ({ ...prev, [key]: { states: [...(prev[key]?.states || []), state], error: null, complete: false } }))
          setReading({ done: i + 1, of: switches })
        }
      })
      if (stop) return
      setSeen((prev) => ({ ...prev, [key]: { states: result.states, error: result.error, complete: !result.error && !result.stopped } }))
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
  }, [key, again, asking])

  const geo = fcGeometry(model)
  const shown = seen[key]
  const busy = !!reading
  const small = { color: color.silkDim, fontSize: font.small }

  return (
    <View style={{ gap: space.md }}>
      <Note>{FC_BUSY_WARNING}</Note>

      {now ? <Text style={{ color: color.silk, fontSize: font.small }}>{nowWords(now, { layouts: geo.layouts, names })}</Text> : null}

      <Text style={small}>Layout</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {Array.from({ length: geo.layouts }, (_, i) => (
          <Press
            key={i}
            label={layoutLabel(i, { layouts: geo.layouts, names, now })}
            height={44}
            tone="signal"
            on={i === layout}
            disabled={busy}
            onPress={() => {
              picked.current = true
              setLayout(i)
            }}
          />
        ))}
      </View>
      <Text style={small}>View</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {Array.from({ length: geo.views }, (_, i) => (
          <Press
            key={i}
            label={viewLabel(i, { layout, now })}
            height={44}
            tone="signal"
            on={i === view}
            disabled={busy}
            onPress={() => {
              picked.current = true
              setView(i)
            }}
          />
        ))}
      </View>

      {asking ? <Text style={small}>Asking which layout is on…</Text> : null}
      {reading ? <Text style={small}>{`Reading switch ${Math.min(reading.done + 1, reading.of)} of ${reading.of}…`}</Text> : null}

      {(shown?.states || []).map((state, i) => {
        const sw = describeSwitch(state, model)
        /* One flat card of glass a switch (lib/glass): a list of up to twelve is never lifted. */
        return (
          <View key={i} style={{ gap: space.xs, padding: space.md, borderWidth: 1, ...glassCard({ bordered: true, flat: true }) }}>
            <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>{`Switch ${sw.number ?? i + 1}`}</Text>
            {sw.unread ? (
              <Text style={small}>The unit didn’t answer for this one.</Text>
            ) : (
              <>
                <Text style={small}>{`Tap: ${sw.tap.pick || sw.tap.action}${sw.tap.label ? ` “${sw.tap.label}”` : ''}`}</Text>
                <Text style={small}>{`Hold: ${sw.hold.pick || sw.hold.action}${sw.hold.label ? ` “${sw.hold.label}”` : ''}`}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  {sw.light?.hex ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: sw.light.hex }} /> : null}
                  <Text style={small}>{lightWords(sw.light)}</Text>
                </View>
              </>
            )}
          </View>
        )
      })}

      {naming ? <Text style={small}>Reading the layout names…</Text> : null}
      {shown?.states?.length ? (
        <Text style={{ color: color.silkFaint, fontSize: font.micro }}>{fcSaysPicks(shown.states) ? FC_PICKS_SOME : FC_NOT_YET}</Text>
      ) : null}
      {shown?.error ? <Note tone="warn">{shown.error}</Note> : null}
      {!busy ? <Press label="Read again" height={44} onPress={() => setAgain((n) => n + 1)} /> : null}
    </View>
  )
}
