import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_PROJECT, supabaseClient } from '../lib/remote'
import { accessAction, handledAsk, handledProblem, salesSections, withHandled } from '../../shared/admin.mjs'
import Facts from './Facts'

/**
 * SALES AT A GLANCE — Justin's page, and nobody else's. The browser's copy of
 * the phone's (mobile/src/components/SalesTool.js), same words, same server,
 * and the same Handled button under every Paid twice and Paid, account never
 * confirmed row, with the same question before it.
 */
export default function SalesTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  const [doing, setDoing] = useState(null)
  const [told, setTold] = useState(null)
  /* What was marked on this page, so a count already on its way when it was
     marked does not put the row back. */
  const marked = useRef([])

  const ask = useCallback(async (action, email, extra) => {
    const client = supabaseClient()
    const { data } = client ? await client.auth.getSession() : { data: null }
    return accessAction({
      url: DEFAULT_PROJECT.url,
      anonKey: DEFAULT_PROJECT.anonKey,
      token: data?.session?.access_token,
      action,
      email,
      extra
    })
  }, [])

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const answer = await ask('sales')
      setSaid(marked.current.reduce((was, row) => withHandled(was, row), answer))
    } finally {
      setBusy(false)
    }
  }, [ask])

  useEffect(() => {
    load()
  }, [load])

  const handle = async (row) => {
    setDoing(`${row.kind}:${row.email}`)
    setTold(null)
    try {
      const res = await ask('handled', row.email, { kind: row.kind, until: row.until, count: row.count, nearCount: row.nearCount })
      if (res.ok) {
        marked.current.push(row)
        setSaid((was) => withHandled(was, row))
        setTold(res)
      } else {
        /* The row stays, so a refusal is said where the click was, not in the
           line at the foot of the page, which is a screen or two below it. */
        setTold({ ...res, message: handledProblem(res) })
        window.alert(handledProblem(res))
      }
    } finally {
      setDoing(null)
    }
  }

  const confirm = (row) => {
    const q = handledAsk(row)
    if (q && window.confirm(`${q.title} ${q.message}`)) handle(row)
  }

  /* Under each row Handled is for, and nothing under any other. */
  const detail = (row) =>
    handledAsk(row) ? (
      <div className="history-actions">
        <button type="button" className="chip" disabled={!!doing} aria-label={`Mark ${row.email} as handled`} onClick={() => confirm(row)}>
          {doing === `${row.kind}:${row.email}` ? 'Marking…' : 'Handled'}
        </button>
      </div>
    ) : null

  return (
    <div className="access-tool">
      {said && !said.ok ? (
        <p className="save-error" role="status">
          {said.message}
        </p>
      ) : null}
      {said?.ok ? salesSections(said).map((s) => <Facts key={s.title} title={s.title} rows={s.rows} detail={detail} />) : null}
      {told ? (
        <p className={told.ok ? 'access-said' : 'access-said save-error'} role="status">
          {told.message}
        </p>
      ) : null}
      <div className="history-actions">
        <button type="button" className="chip" disabled={busy} onClick={load}>
          {busy ? 'Counting…' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}
