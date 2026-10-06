import { useRef, useState } from 'react'
import { rawSysex } from '../lib/forgefx'
import { CHECKS, PAUSE_MS, readFrame, sayMoved, sayValue, valueFrom } from '../../shared/am4-check.mjs'

/**
 * THE AM4 CHECK — Justin's page, in the Mac app's own window only.
 *
 * One button per setting. A press asks the AM4 about that one setting, once,
 * and shows the answer. Change the setting on the AM4's screen and press again:
 * the page says which bytes of the answer moved, and that is where the value
 * lives. Nothing here writes to the unit. The rules, and why each address is on
 * the list, are in shared/am4-check.mjs.
 */
export default function Am4Check() {
  const [answers, setAnswers] = useState({})
  const [busy, setBusy] = useState(null)
  const [copied, setCopied] = useState(false)
  const last = useRef(0)

  const read = async (check) => {
    if (busy) return
    if (Date.now() < last.current + PAUSE_MS) return
    setBusy(check.key)
    setCopied(false)
    try {
      const value = valueFrom(check, await rawSysex(readFrame(check)))
      setAnswers((a) => {
        const before = a[check.key]?.value || null
        return {
          ...a,
          [check.key]: { value, now: sayValue(check, value), moved: before && value ? sayMoved(before, value) : null }
        }
      })
    } catch (err) {
      setAnswers((a) => ({ ...a, [check.key]: { value: a[check.key]?.value || null, now: `Didn’t reach the AM4: ${err?.message || err}`, moved: null } }))
    } finally {
      last.current = Date.now()
      setBusy(null)
    }
  }

  const copy = async () => {
    const text = CHECKS.map((c) => {
      const a = answers[c.key]
      return a ? `${c.label}: ${a.now}${a.moved ? `\n  ${a.moved}` : ''}` : `${c.label}: not read`
    }).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="access-tool">
      <p className="footnote">
        Press Read. Then change that setting on the AM4 itself and press Read again. For the output level, read once while playing and once while silent. The page
        says what moved in the AM4&rsquo;s answer. Then press Copy and paste it into the chat. This only reads; it
        cannot change or save anything on the AM4.
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
          {answers[check.key] ? <p className="hint mono">Now: {answers[check.key].now}</p> : null}
          {answers[check.key]?.moved ? <p className="mono">{answers[check.key].moved}</p> : null}
        </div>
      ))}
      <div className="history-actions">
        <button type="button" className="chip" disabled={!Object.keys(answers).length} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
