import { useCallback, useEffect, useState } from 'react'
import { VERSION } from '../lib/version'
import { fetchLive, liveRows } from '../../shared/whats-live.mjs'
import Facts from './Facts'

/**
 * WHAT'S LIVE — Justin's page. The browser's copy of the phone's
 * (mobile/src/components/LiveTool.js): the same words from
 * shared/whats-live.mjs, with "This page" in place of "This phone".
 */
export default function LiveTool() {
  const [live, setLive] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setLive(await fetchLive())
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="access-tool">
      <Facts rows={live ? liveRows(live, { kind: 'browser', version: VERSION }) : []} />
      <button type="button" className="chip" disabled={busy} onClick={load}>
        {busy ? 'Checking…' : 'Check again'}
      </button>
    </div>
  )
}
