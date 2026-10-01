import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { color, font, radius, space } from '../lib/theme'
import { fcModel, fcSwitch } from '../lib/device'
import { FC_BUSY_WARNING, FC_NOT_YET, describeSwitch, fcGeometry, layoutName, lightWords, readView } from '../lib/footswitches'
import Note from './Note'
import Press from './Press'

/**
 * WHAT EACH FOOTSWITCH DOES — the browser's Footswitches panel, on the phone.
 *
 * One layout and view at a time, one switch at a time, at the pace
 * lib/footswitches sets: reading a switch is about thirty questions to the
 * unit, so the page reads only while it is open and says so first. Read-only.
 */
export default function Footswitches() {
  const [model, setModel] = useState(null)
  const [layout, setLayout] = useState(0)
  const [view, setView] = useState(0)
  const [seen, setSeen] = useState({})
  const [reading, setReading] = useState(null)
  const [again, setAgain] = useState(0)
  const seenRef = useRef(seen)
  seenRef.current = seen
  const askedAgain = useRef(0)
  const key = `${layout}:${view}`

  useEffect(() => {
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
    })()
    return () => {
      stop = true
      setReading(null)
    }
    // `model` is read, not watched: loading it must not start a second read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, again])

  const geo = fcGeometry(model)
  const shown = seen[key]
  const busy = !!reading
  const small = { color: color.silkDim, fontSize: font.small }

  return (
    <View style={{ gap: space.md }}>
      <Note>{FC_BUSY_WARNING}</Note>

      <Text style={small}>Layout</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {Array.from({ length: geo.layouts }, (_, i) => (
          <Press key={i} label={layoutName(i, geo.layouts)} height={44} tone="signal" on={i === layout} disabled={busy} onPress={() => setLayout(i)} />
        ))}
      </View>
      <Text style={small}>View</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {Array.from({ length: geo.views }, (_, i) => (
          <Press key={i} label={`View ${i + 1}`} height={44} tone="signal" on={i === view} disabled={busy} onPress={() => setView(i)} />
        ))}
      </View>

      {reading ? <Text style={small}>{`Reading switch ${Math.min(reading.done + 1, reading.of)} of ${reading.of}…`}</Text> : null}

      {(shown?.states || []).map((state, i) => {
        const sw = describeSwitch(state, model)
        return (
          <View key={i} style={{ gap: space.xs, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.rule, backgroundColor: color.panel }}>
            <Text style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>{`Switch ${sw.number ?? i + 1}`}</Text>
            {sw.unread ? (
              <Text style={small}>The unit didn’t answer for this one.</Text>
            ) : (
              <>
                <Text style={small}>{`Tap: ${sw.tap.action}${sw.tap.label ? ` “${sw.tap.label}”` : ''}`}</Text>
                <Text style={small}>{`Hold: ${sw.hold.action}${sw.hold.label ? ` “${sw.hold.label}”` : ''}`}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  {sw.light?.hex ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: sw.light.hex }} /> : null}
                  <Text style={small}>{lightWords(sw.light)}</Text>
                </View>
              </>
            )}
          </View>
        )
      })}

      {shown?.states?.length ? <Text style={{ color: color.silkFaint, fontSize: font.micro }}>{FC_NOT_YET}</Text> : null}
      {shown?.error ? <Note tone="warn">{shown.error}</Note> : null}
      {!busy ? <Press label="Read again" height={44} onPress={() => setAgain((n) => n + 1)} /> : null}
    </View>
  )
}
