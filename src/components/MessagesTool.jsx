import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PROJECT, supabaseClient } from '../lib/remote'
import { messageDetail, messageSections, messagesAction } from '../../shared/admin.mjs'
import Facts from './Facts'

/**
 * MESSAGES FROM USERS — Justin's page, and nobody else's. The browser's copy
 * of the phone's (mobile/src/components/MessagesTool.js): the same words from
 * shared/admin.mjs, the same server (supabase/functions/owner-messages).
 * Click a report and it opens in place, with its log and a Copy button.
 */
export default function MessagesTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [open, setOpen] = useState(null)
  const [told, setTold] = useState(null)

  const token = async () => {
    const client = supabaseClient()
    const { data } = client ? await client.auth.getSession() : { data: null }
    return data?.session?.access_token
  }

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setSaid(await messagesAction({ url: DEFAULT_PROJECT.url, anonKey: DEFAULT_PROJECT.anonKey, token: await token() }))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const pick = async (row) => {
    setTold(null)
    if (openId === row.id) {
      setOpenId(null)
      setOpen(null)
      return
    }
    setOpenId(row.id)
    setOpen({ loading: true })
    const res = await messagesAction({
      url: DEFAULT_PROJECT.url,
      anonKey: DEFAULT_PROJECT.anonKey,
      token: await token(),
      action: 'message',
      id: row.id
    })
    setOpen(res.ok ? messageDetail(res.message) : { failed: res.message })
  }

  const copy = async () => {
    const text = [open.message, '', ...open.facts.map((f) => `${f.label}: ${f.value}`), ...(open.log ? ['', 'Log:', open.log] : [])].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setTold({ ok: true, message: 'Copied.' })
    } catch (err) {
      setTold({ ok: false, message: `Couldn’t copy it (${err?.message || err}). Select the words and copy them instead.` })
    }
  }

  const detail = (row) => {
    if (row.id !== openId || !open) return null
    return (
      <div className="facts-open">
        {open.loading ? <p className="hint">Loading…</p> : null}
        {open.failed ? <p className="save-error">{open.failed}</p> : null}
        {open.facts ? (
          <>
            <p className="message-text">{open.message}</p>
            <Facts rows={open.facts} />
            {open.log ? <pre className="message-log">{open.log}</pre> : <p className="hint">No log came with this one.</p>}
            {told ? (
              <p className={told.ok ? 'access-said' : 'access-said save-error'} role="status">
                {told.message}
              </p>
            ) : null}
            <div className="history-actions">
              <button type="button" className="chip" onClick={copy}>
                Copy all of it
              </button>
            </div>
          </>
        ) : null}
      </div>
    )
  }

  return (
    <div className="access-tool">
      {said && !said.ok ? (
        <p className="save-error" role="status">
          {said.message}
        </p>
      ) : null}
      {said?.ok ? messageSections(said).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} onRow={pick} detail={detail} />) : null}
      <button type="button" className="chip" disabled={busy} onClick={load}>
        {busy ? 'Loading…' : 'Refresh'}
      </button>
    </div>
  )
}
