import { useRef, useState } from 'react'
import { rawSysex } from '../lib/forgefx'
import { CHECKS, PAUSE_MS, readFrame, sayValue, valueFrom } from '../../shared/am4-check.mjs'

/**
 * THE AM4 CHECK — Justin's page, in the Mac app's own window only.
 *
 * One button per setting. A press asks the AM4 for that one value, once, and
 * shows it. Change the setting on the AM4's screen and press again: if the
 * number follows, the address is found. Nothing here writes to the unit. The
 * rules, and why each address is on the list, are in shared/am4-check.mjs.
 */
export default function Am4Check() {
  const [answers, setAnswers] = useState({})
  const [busy, setBusy] = useState(null)
  const last = useRef(0)

  const read = async (check) => {
    if (busy) return
    const wait = last.current + PAUSE_MS - Date.now()
    if (wait > 0) return
    setBusy(check.key)
    try {
      const value = valueFrom(check, await rawSysex(readFrame(check)))
      setAnswers((a) => ({ ...a, [check.key]: [sayValue(check, value), ...(a[check.key] || [])].slice(0, 4) }))
    } catch (err) {
      setAnswers((a) => ({ ...a, [check.key]: [`Didn’t reach the AM4: ${err?.message || err}`, ...(a[check.key] || [])].slice(0, 4) }))
    } finally {
      last.current = Date.now()
      setBusy(null)
    }
  }

  return (
    <div className="access-tool">
      <p className="footnote">
        Press Read. Then change that setting on the AM4 itself (its Controllers page) and press Read again. If the
        number follows what the AM4 shows, we have found it. This only reads; it cannot change or save anything on the
        AM4.
      </p>
      {CHECKS.map((check) => (
        <div key={check.key} className="setup-rows">
          <p className="hint">
            {check.label} <span className="mono">({check.where})</span>
          </p>
          <div className="history-actions">
            <button type="button" className="chip" disabled={!!busy} onClick={() => read(check)}>
              {busy === check.key ? 'Reading…' : 'Read'}
            </button>
          </div>
          {(answers[check.key] || []).map((line, i) => (
            <p key={i} className={i === 0 ? 'mono' : 'hint mono'}>
              {i === 0 ? 'Now: ' : 'Before: '}
              {line}
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}
