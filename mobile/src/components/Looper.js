import { useEffect, useRef, useState } from 'react'
import { AppState, Text, View } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { looperControl, looperTelemetry } from '../lib/device'
import { thud, tick } from '../lib/feedback'
import { useRig } from '../lib/rig'
import {
  IDLE_LATCH,
  LOOPER_LABEL,
  LOOPER_ROWS,
  PRESS_MS,
  STOP_EVERYTHING,
  TELEMETRY_MISSES,
  TELEMETRY_MS,
  isToggle,
  looperKey,
  looperStatus,
  looperTap,
  readTelemetry,
  waveBars
} from '../lib/looper'
import Note from './Note'
import Press from './Press'

const ofPresetNumber = (s) => s.preset?.number ?? null

/*
 * What this app has switched on, per preset and looper. Kept outside the panel
 * so closing it and opening it again in the same song still shows Record lit.
 */
const latches = new Map()

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * "Stop the looper" from Settings — every write that means stop, in order.
 * Clears every latch this app holds, because after it nothing should be lit.
 */
export async function stopLooper(eid) {
  for (const [action, on] of STOP_EVERYTHING) {
    await looperControl(eid, action, on)
    if (action === 'stop' && on) await wait(PRESS_MS)
  }
  latches.clear()
}

/**
 * The looper's buttons, for the Looper block in this preset.
 *
 * Opened from the Looper pedal on Edit and from the Looper button on the play
 * screen. Rec, Play and Stop on the top row because they are the three a foot
 * would want; the rest under them.
 */
export default function Looper({ block }) {
  const number = useRig(ofPresetNumber)
  const eid = block?.effectId
  const key = looperKey(number, eid)
  const [latch, setLatch] = useState(() => latches.get(key) || IDLE_LATCH)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const tele = useTelemetry(eid)

  useEffect(() => setLatch(latches.get(key) || IDLE_LATCH), [key])

  async function tap(action) {
    if (busy || eid == null) return
    ;(action === 'record' ? thud : tick)()
    setBusy(action)
    setError(null)
    const { sends, next } = looperTap(latch, action)
    try {
      for (let i = 0; i < sends.length; i++) {
        if (i) await wait(PRESS_MS)
        const r = await looperControl(eid, action, sends[i])
        if (r?.ok === false) throw new Error('The unit did not take it.')
      }
      latches.set(key, next)
      setLatch(next)
    } catch (e) {
      setError(e?.message || 'The looper did not answer.')
    } finally {
      setBusy(null)
    }
  }

  const status = looperStatus(latch, tele.moving)

  return (
    <View
      style={{
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: color.rule,
        backgroundColor: color.panel
      }}
    >
      <Text
        accessibilityLiveRegion="polite"
        style={{ color: color.silk, fontSize: font.small, letterSpacing: 1.2, textTransform: 'uppercase' }}
      >
        Looper · {status}
      </Text>

      <Wave tele={tele} />

      {LOOPER_ROWS.map((row) => (
        <View key={row.join('-')} style={{ flexDirection: 'row', gap: space.sm }}>
          {row.map((action) => (
            <Press
              key={action}
              grow
              height={64}
              label={busy === action ? '…' : LOOPER_LABEL[action]}
              accessibilityLabel={`Looper ${LOOPER_LABEL[action]}`}
              tone={action === 'record' ? 'signal' : 'live'}
              on={isToggle(action) && !!latch[action]}
              disabled={!!busy && busy !== action}
              haptic={null}
              onPress={() => tap(action)}
            />
          ))}
        </View>
      ))}

      {block?.bypassed ? (
        <Note tone="warn">The Looper block is switched off in this scene, so you won’t hear the loop.</Note>
      ) : null}
      {error ? (
        <Note tone="fault" onDismiss={() => setError(null)}>
          {error}
        </Note>
      ) : (
        <Text style={{ color: color.silkFaint, fontSize: font.micro }}>
          Lit buttons are the ones this app switched on. The unit’s own looper lights have the final say.
        </Text>
      )}
    </View>
  )
}

/** Asks where the playhead is while the panel is open and the app is in front. Gives up after a few misses. */
function useTelemetry(eid) {
  const [data, setData] = useState(null)
  const [moving, setMoving] = useState(false)
  const [gone, setGone] = useState(false)
  const last = useRef(null)

  useEffect(() => {
    if (eid == null) return undefined
    let stop = false
    let busy = false
    let misses = 0
    const ask = async () => {
      if (stop || busy || AppState.currentState !== 'active') return
      busy = true
      try {
        const next = readTelemetry(await looperTelemetry(eid))
        if (stop) return
        misses = 0
        const pos = next.position
        setMoving(pos != null && last.current != null && Math.abs(pos - last.current) > 0.001)
        last.current = pos
        setData(next)
      } catch {
        misses += 1
        if (misses >= TELEMETRY_MISSES) {
          stop = true
          setGone(true)
        }
      } finally {
        busy = false
      }
    }
    ask()
    const id = setInterval(ask, TELEMETRY_MS)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [eid])

  return { data, moving, gone }
}

/** The loop as bars of plain views — the phone has no drawing library — with the playhead over it. */
function Wave({ tele }) {
  const bars = waveBars(tele.data?.wave)
  const pos = tele.data?.position
  if (tele.gone && !bars.length) return null
  const frame = {
    height: 56,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.rule,
    backgroundColor: color.chassis,
    overflow: 'hidden'
  }
  if (!bars.length) {
    return (
      <View style={[frame, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: color.silkDim, fontSize: font.small }}>No loop yet. Tap Rec to start.</Text>
      </View>
    )
  }
  return (
    <View style={[frame, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }]}>
      {bars.map((v, i) => (
        <View
          key={i}
          style={{ flex: 1, marginHorizontal: 0.5, height: `${Math.max(4, v * 90)}%`, backgroundColor: color.silkDim }}
        />
      ))}
      {pos != null ? (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos * 100}%`, width: 2, backgroundColor: color.signal }} />
      ) : null}
    </View>
  )
}
