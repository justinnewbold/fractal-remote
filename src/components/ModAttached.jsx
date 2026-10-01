import { useEffect, useRef, useState } from 'react'
import { blockParams, rawBlock } from '../lib/forgefx'
import { getSnapshot, useDevice } from '../lib/deviceState'
import { logDebug } from '../lib/debugLog'
import { attachedSummary, readAttached } from '../../shared/mod-read.mjs'

const ofNumber = (s) => s.preset?.number ?? null

/**
 * WHAT IS ATTACHED NOW — each modifier slot, read off the unit on request.
 *
 * On request rather than on opening: a unit has dozens of slots and each is a
 * read, so it costs a few seconds, and nobody opening Modifiers to attach one
 * should wait for them. See shared/mod-read.mjs, the phone's too.
 */
export default function ModAttached({ model, blocks }) {
  const number = useDevice(ofNumber)
  const [res, setRes] = useState(null)
  const [reading, setReading] = useState(null)
  const alive = useRef(true)
  useEffect(() => () => {
    alive.current = false
  }, [])
  /* Another preset's slots are not these. */
  useEffect(() => setRes(null), [number])

  const read = async () => {
    const n0 = getSnapshot().preset?.number ?? null
    setRes(null)
    setReading({ done: 0, total: model.slotCount || 0 })
    const got = await readAttached({
      model,
      blocks,
      readRaw: rawBlock,
      readControls: blockParams,
      progress: (p) => alive.current && setReading(p),
      stillHere: () => alive.current && (getSnapshot().preset?.number ?? null) === n0,
      log: (line) => logDebug('modifiers', line, '')
    })
    if (!alive.current) return
    setReading(null)
    setRes(got)
  }

  const summary = attachedSummary(res)
  return (
    <div className="mod-attached">
      <button type="button" className="chip" disabled={!!reading} onClick={read}>
        {reading ? `Reading slot ${Math.min(reading.done + 1, reading.total)} of ${reading.total}…` : res ? 'Read again' : 'Show what’s attached'}
      </button>
      {res?.lines?.length ? (
        <ul className="mod-attached-list">
          {res.lines.map((l) => (
            <li key={l.slot} className={l.known ? '' : 'hint'}>
              {l.known ? (
                <>
                  <span className="diff-label">Slot {l.slot}</span> {l.text}
                </>
              ) : (
                l.text
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {summary ? (
        <p className="hint" role="status">
          {summary}
        </p>
      ) : null}
    </div>
  )
}
