import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_PROJECT, supabaseClient } from '../lib/remote'
import { accessAction, accountChoices, accountSections } from '../../shared/admin.mjs'
import Facts from './Facts'

/**
 * EVERYONE WITH AN ACCOUNT — Justin's page, and nobody else's. The browser's
 * copy of the phone's (mobile/src/components/AccountsTool.js), same words,
 * same server.
 *
 * "Can you make it so I can copy and paste off of this page? Or that I can
 * click on it to give them access from that screen?" Click somebody and their
 * row opens: Copy email, and Give access or Take it back — see accountChoices
 * in shared/admin.mjs. The words on the page could always be selected here.
 */
export default function AccountsTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  const [find, setFind] = useState('')
  const [open, setOpen] = useState(null)
  const [doing, setDoing] = useState(null)
  const [told, setTold] = useState(null)

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
          action: 'accounts'
        })
      )
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const pick = (row) => {
    setTold(null)
    setOpen((was) => (was?.email === row.email ? null : row))
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(open.email)
      setTold({ ok: true, message: `Copied ${open.email}.` })
    } catch (err) {
      setTold({ ok: false, message: `Couldn’t copy it (${err?.message || err}). Select the email and copy it instead.` })
    }
  }

  const act = async (action) => {
    setDoing(action)
    setTold(null)
    try {
      const client = supabaseClient()
      const { data } = client ? await client.auth.getSession() : { data: null }
      const res = await accessAction({
        url: DEFAULT_PROJECT.url,
        anonKey: DEFAULT_PROJECT.anonKey,
        token: data?.session?.access_token,
        action,
        email: open.email
      })
      setTold(res)
      if (res.ok) {
        setOpen((was) => (was ? { ...was, unlocked: action === 'grant', waiting: false } : was))
        load()
      }
    } finally {
      setDoing(null)
    }
  }

  const detail = (row) => {
    if (!open || row.email !== open.email) return null
    const choices = accountChoices(open)
    return (
      <div className="facts-open">
        {told ? (
          <p className={told.ok ? 'access-said' : 'access-said save-error'} role="status">
            {told.message}
          </p>
        ) : null}
        <div className="history-actions">
          <button type="button" className="chip" disabled={!!doing} onClick={copy}>
            Copy email
          </button>
          {choices.give ? (
            <button type="button" className="primary" disabled={!!doing} onClick={() => act('grant')}>
              {doing === 'grant' ? 'Giving access…' : 'Give access'}
            </button>
          ) : null}
          {choices.takeBack ? (
            <button type="button" className="chip" disabled={!!doing} onClick={() => act('revoke')}>
              {doing === 'revoke' ? 'Taking it back…' : 'Take it back'}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="access-tool">
      <input
        type="text"
        inputMode="email"
        className="access-email"
        value={find}
        onChange={(e) => setFind(e.target.value)}
        placeholder="Find an email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {said && !said.ok ? (
        <p className="save-error" role="status">
          {said.message}
        </p>
      ) : null}
      {said?.ok
        ? accountSections(said, find).map((s) => (
            <Facts key={s.title} title={s.title} rows={s.rows} onRow={pick} detail={detail} />
          ))
        : null}
      <div className="history-actions">
        <button type="button" className="chip" disabled={busy} onClick={load}>
          {busy ? 'Loading…' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}
