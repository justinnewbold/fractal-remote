import { useState } from 'react'
import { useDevice, writeBypass, writeScene, refreshSceneState } from '../lib/deviceState'
import { sceneState, setChannel } from '../lib/forgefx'
import { copyScene } from '../../shared/copy-tools.mjs'

const ofScene = (s) => s.sceneIndex

/**
 * COPY A SCENE ONTO ANOTHER — "build scene 2 starting from scene 1, instead of
 * switching every pedal by hand". Every block's on/off and channel go across
 * (shared/copy-tools.mjs, the phone's own copy too); the name does not. The
 * unit is left on the scene copied to, so what was made is what is heard.
 * Asked first, because the other scene's switches go.
 */
export default function SceneCopy({ count = 8, names = [], busy, onChanged, onError }) {
  const scene = useDevice(ofScene)
  const here = Number.isInteger(scene) ? scene : 0
  const [from, setFrom] = useState(here)
  const [to, setTo] = useState((here + 1) % count)
  const [asking, setAsking] = useState(false)
  const [working, setWorking] = useState(false)
  const label = (i) => `Scene ${i + 1}${names[i] ? ` · ${names[i]}` : ''}`

  const run = async () => {
    setWorking(true)
    try {
      const res = await copyScene({ from, to, wire: { setScene: writeScene, sceneState, setBypass: writeBypass, setChannel } })
      await refreshSceneState()
      if (res.ok) onChanged?.(`${label(from)} copied onto scene ${to + 1} (${res.changed} change${res.changed === 1 ? '' : 's'})`, { reread: false })
      else onError?.(`Copying the scene stopped: ${res.error}`)
    } catch (err) {
      onError?.(err?.message || String(err))
    } finally {
      setWorking(false)
      setAsking(false)
    }
  }

  return (
    <section className="scene-copy">
      <p className="silk-label">Copy a scene</p>
      <div className="scene-copy-row">
        <label>
          <span className="hint">From</span>
          <select value={from} onChange={(e) => setFrom(Number(e.target.value))} disabled={busy || working}>
            {Array.from({ length: count }, (_, i) => (
              <option key={i} value={i}>
                {label(i)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="hint">Onto</span>
          <select value={to} onChange={(e) => setTo(Number(e.target.value))} disabled={busy || working}>
            {Array.from({ length: count }, (_, i) => (
              <option key={i} value={i}>
                {label(i)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {asking ? (
        <div className="rows-confirm" role="alertdialog" aria-label="Copy the scene">
          <p>
            Copy {label(from)} onto scene {to + 1}? Every block in scene {to + 1} takes scene {from + 1}&rsquo;s on/off
            and channel. Its name stays. Nothing is saved until you press Save.
          </p>
          <div className="history-actions">
            <button type="button" className="primary" disabled={working} onClick={run}>
              {working ? 'Copying…' : 'Copy it'}
            </button>
            <button type="button" className="chip" disabled={working} onClick={() => setAsking(false)}>
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="chip" disabled={busy || working || from === to} onClick={() => setAsking(true)}>
          {from === to ? 'Pick two different scenes' : `Copy scene ${from + 1} onto scene ${to + 1}`}
        </button>
      )}
    </section>
  )
}
