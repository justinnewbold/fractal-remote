import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PROJECT, supabaseClient } from '../lib/remote'
import { accessAction, usageSections } from '../../shared/admin.mjs'
import Facts from './Facts'

/**
 * HOW MANY PEOPLE — Justin's page, and nobody else's. The browser's copy of
 * the phone's (mobile/src/components/UsageTool.js), same words, same server.
 */
export default function UsageTool() {
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
          action: 'usage'
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
          {said.message}
        </p>
      ) : null}
      {said?.ok ? usageSections(said).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} />) : null}
      <div className="history-actions">
        <button type="button" className="chip" disabled={busy} onClick={load}>
          {busy ? 'Counting…' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}
