import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_PROJECT, supabaseClient } from '../lib/remote'
import { accessAction, accountChoices, accountConfirmHint, accountFilterButtons, accountRow, accountSections, samePerson, signInHelpWords } from '../../shared/admin.mjs'
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
 * And Confirm their account now for somebody who never confirmed their email,
 * beside them (2 November 2026), as on the phone. And the phone's buttons
 * to narrow the list (ACCOUNT_FILTERS in shared/admin.mjs), under the find box.
 */
export default function AccountsTool() {
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  const [find, setFind] = useState('')
  const [show, setShow] = useState('all')
  const [open, setOpen] = useState(null)
  const [doing, setDoing] = useState(null)
  const [told, setTold] = useState(null)
  const openNow = useRef(open)
  openNow.current = open

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

  /* The open row redrawn from the list just read, so what it offers is what is true now. */
  useEffect(() => {
    if (said?.ok) setOpen((was) => (was ? accountRow(said, was) || was : was))
  }, [said])

  const pick = (row) => {
    setTold(null)
    setOpen((was) => (samePerson(was, row) ? null : row))
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
    /* Who this is for, kept: another person can be opened while it runs, and the answer is this one's alone. */
    const who = open
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
        email: who.email
      })
      if (samePerson(openNow.current, who)) {
        /* Confirming emails nobody, so its line says to tell them (signInHelpWords, as on Give access). */
        setTold(action === 'confirm' ? signInHelpWords('confirmNow', who.email, res.ok ? null : res.message) : res)
        /* The list under the sheet says Unlocked or Not unlocked, and whether they
           confirmed; read it again so it says what just happened. */
        if (res.ok) {
          setOpen((was) =>
            samePerson(was, who) ? (action === 'confirm' ? { ...was, confirmed: true } : { ...was, unlocked: action === 'grant', waiting: false }) : was
          )
        }
      }
      if (res.ok) load()
    } finally {
      setDoing(null)
    }
  }

  const detail = (row) => {
    /* The account and the same address on the waiting list are two rows: only the one clicked opens. */
    if (!open || !samePerson(row, open)) return null
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
          {choices.confirmNow ? (
            <button type="button" className="chip" disabled={!!doing} onClick={() => act('confirm')}>
              {doing === 'confirm' ? 'Confirming…' : 'Confirm their account now'}
            </button>
          ) : null}
        </div>
        {choices.confirmNow ? <p className="hint">{accountConfirmHint(open)}</p> : null}
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
      {said?.ok ? (
        <div className="history-actions" role="group" aria-label="Show">
          {accountFilterButtons(said, find).map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={f.key === show}
              className={`chip${f.key === show ? ' active' : ''}`}
              onClick={() => setShow(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}
      {said && !said.ok ? (
        <p className="save-error" role="status">
          {said.message}
        </p>
      ) : null}
      {said?.ok
        ? accountSections(said, find, Date.now(), show, open).map((s) => (
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
