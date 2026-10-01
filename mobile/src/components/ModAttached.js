import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { color, font, space } from '../lib/theme'
import { blockParams, rawBlock } from '../lib/device'
import { getState, useRig } from '../lib/rig'
import { logDebug } from '../lib/debugLog'
import { attachedSummary, readAttached } from '../lib/mod-read'
import Press from './Press'

const ofNumber = (s) => s.preset?.number ?? null

/**
 * WHAT IS ATTACHED NOW — each modifier slot, read off the unit on request.
 *
 * A tap rather than on opening: there are dozens of slots and each is a read.
 * The browser's own (src/components/ModAttached.jsx); the reading is
 * lib/mod-read, shared.
 */
export default function ModAttached({ model, blocks }) {
  const number = useRig(ofNumber)
  const [res, setRes] = useState(null)
  const [reading, setReading] = useState(null)
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    []
  )
  /* Another preset's slots are not these. */
  useEffect(() => setRes(null), [number])

  const read = async () => {
    const n0 = getState().preset?.number ?? null
    setRes(null)
    setReading({ done: 0, total: model.slotCount || 0 })
    const got = await readAttached({
      model,
      blocks,
      readRaw: rawBlock,
      readControls: blockParams,
      progress: (p) => alive.current && setReading(p),
      stillHere: () => alive.current && (getState().preset?.number ?? null) === n0,
      log: (line) => logDebug('modifiers', line, '')
    })
    if (!alive.current) return
    setReading(null)
    setRes(got)
  }

  const summary = attachedSummary(res)
  return (
    <View style={{ gap: space.sm }}>
      <Press
        label={reading ? `Reading slot ${Math.min(reading.done + 1, reading.total)} of ${reading.total}…` : res ? 'Read again' : 'Show what’s attached'}
        disabled={!!reading}
        onPress={read}
      />
      {(res?.lines || []).map((l) => (
        <Text key={l.slot} style={{ color: l.known ? color.silk : color.silkDim, fontSize: font.small, lineHeight: 20 }}>
          {l.known ? `Slot ${l.slot}: ${l.text}` : l.text}
        </Text>
      ))}
      {summary ? <Text style={{ color: color.silkDim, fontSize: font.micro }}>{summary}</Text> : null}
    </View>
  )
}
