import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PROJECT, supabaseClient } from '../lib/remote'
import { accessAction, trialsPageSections, trialsProblem } from '../../shared/admin.mjs'
import Facts from './Facts'

/**
 * FREE TRIALS — Justin's page, and nobody else's. The browser's copy of the
 * phone's (mobile/src/components/TrialsTool.js), same words, same server.
 */
export default function TrialsTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const client = supabaseClient()
      const { data } = client ? await client.auth.getSession() : { data: null }
      setSaid(
        await accessAction({
          url: DEFAULT_PROJECT.url,
          anonKey: DEFAULT_PROJECT.anonKey,
          token: data?.session?.access_token,
          action: 'trials'
        })
      )
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="access-tool">
      {said && !said.ok ? (
        <p className="save-error" role="status">
          {trialsProblem(said)}
        </p>
      ) : null}
      {said?.ok ? trialsPageSections(said).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} />) : null}
      <div className="history-actions">
        <button type="button" className="chip" disabled={busy} onClick={load}>
          {busy ? 'Counting…' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}
