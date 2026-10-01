import { useEffect, useRef, useState } from 'react'
import { looperControl, looperTelemetry } from '../lib/forgefx'
import { tick as haptic } from '../lib/feedback'
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
} from '../../shared/looper.mjs'

/*
 * What this app has switched on, per preset and looper. Outside the panel so
 * closing it and opening it again in the same song still shows Record lit.
 */
const latches = new Map()

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** "Stop the looper" from Setup — every write that means stop, in order. */
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
 * Opened from the Looper pedal on Edit and from the Looper button on Play —
 * the same panel the phone draws, from the same rules in shared/looper.mjs.
 */
export default function Looper({ block, presetNumber }) {
  const eid = block?.effectId
  const key = looperKey(presetNumber, eid)
  const [latch, setLatch] = useState(() => latches.get(key) || IDLE_LATCH)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const tele = useTelemetry(eid)

  useEffect(() => setLatch(latches.get(key) || IDLE_LATCH), [key])

  async function tap(action) {
    if (busy || eid == null) return
    haptic()
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

  return (
    <div className="looper">
      <p className="looper-status" aria-live="polite">
        Looper · {looperStatus(latch, tele.moving)}
      </p>

      <Wave tele={tele} />

      {LOOPER_ROWS.map((row) => (
        <div key={row.join('-')} className={`looper-row looper-row-${row.length}`}>
          {row.map((action) => {
            const lit = isToggle(action) && !!latch[action]
            return (
              <button
                key={action}
                type="button"
                className={`looper-btn looper-${action} ${lit ? 'lit' : ''}`}
                aria-pressed={isToggle(action) ? lit : undefined}
                aria-label={`Looper ${LOOPER_LABEL[action]}`}
                disabled={!!busy && busy !== action}
                onClick={() => tap(action)}
              >
                {busy === action ? '…' : LOOPER_LABEL[action]}
              </button>
            )
          })}
        </div>
      ))}

      {block?.bypassed ? (
        <p className="hint looper-warn">The Looper block is switched off in this scene, so you won’t hear the loop.</p>
      ) : null}
      {error ? (
        <p className="looper-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="hint">Lit buttons are the ones this app switched on. The unit’s own looper lights have the final say.</p>
      )}
    </div>
  )
}

/** Asks where the playhead is while the panel is open and the tab is visible. Gives up after a few misses. */
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
      if (stop || busy || (typeof document !== 'undefined' && document.hidden)) return
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

function Wave({ tele }) {
  const bars = waveBars(tele.data?.wave, 120)
  const pos = tele.data?.position
  if (tele.gone && !bars.length) return null
  if (!bars.length) {
    return (
      <div className="looper-wave looper-wave-empty">
        <span>No loop yet. Tap Rec to start.</span>
      </div>
    )
  }
  return (
    <div className="looper-wave" role="img" aria-label="The loop">
      {bars.map((v, i) => (
        <span key={i} className="looper-bar" style={{ height: `${Math.max(4, v * 90)}%` }} />
      ))}
      {pos != null ? <span className="looper-head" style={{ left: `${pos * 100}%` }} /> : null}
    </div>
  )
}
