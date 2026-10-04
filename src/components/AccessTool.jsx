import { useState } from 'react'
import { DEFAULT_PROJECT, resendConfirmation, sendPasswordReset, supabaseClient } from '../lib/remote'
import { accessAction, lookupRows, signInHelp, signInHelpWords } from '../../shared/admin.mjs'
import Facts from './Facts'

/**
 * GIVE SOMEONE ACCESS — Justin's page, and nobody else's. The browser's copy
 * of the phone's (mobile/src/components/AccessTool.js), same words, same
 * server: supabase/functions/grant-access, which decides who may ask.
 */
export default function AccessTool() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(null)
  const [said, setSaid] = useState(null)
  const [helped, setHelped] = useState(null)

  /* Help them sign in: the email they are missing, for the address looked up. */
  const help = async (kind) => {
    const address = said.email
    setBusy(kind)
    setHelped(null)
    try {
      if (kind === 'confirm') await resendConfirmation({ email: address })
      else await sendPasswordReset({ email: address })
      setHelped(signInHelpWords(kind, address))
    } catch (err) {
      setHelped(signInHelpWords(kind, address, err?.message || String(err)))
    } finally {
      setBusy(null)
    }
  }

  const run = async (action) => {
    const address = email.trim()
    if (!address.includes('@')) {
      setSaid({ ok: false, message: 'Type the email address they signed up with.' })
      return
    }
    setBusy(action)
    setSaid(null)
    setHelped(null)
    try {
      const client = supabaseClient()
      const { data } = client ? await client.auth.getSession() : { data: null }
      setSaid(
        await accessAction({
          url: DEFAULT_PROJECT.url,
          anonKey: DEFAULT_PROJECT.anonKey,
          token: data?.session?.access_token,
          action,
          email: address
        })
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="access-tool">
      <p className="hint">
        Type their email. Give access unlocks them for good and emails them to say so; if they have not signed up
        yet, they go on a waiting list and are unlocked the first time they sign in. Take it back removes an unlock
        given here, or takes them off the list, and never touches one they paid for.
      </p>
      <input
        type="text"
        inputMode="email"
        className="access-email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="their@email.com"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {/* The answer under the address it is about, and an address with no
          account as a warning: it is not a success. Same as the phone's. */}
      {said ? (
        <p className={said.ok && (said.found !== false || said.waiting) ? 'hint access-said' : 'save-error access-said'} role="status">
          {said.message}
        </p>
      ) : null}
      <div className="history-actions">
        <button type="button" className="chip" disabled={!!busy} onClick={() => run('check')}>
          {busy === 'check' ? 'Checking…' : 'Check'}
        </button>
        <button type="button" className="primary" disabled={!!busy} onClick={() => run('grant')}>
          {busy === 'grant' ? 'Giving access…' : 'Give access'}
        </button>
        <button type="button" className="chip" disabled={!!busy} onClick={() => run('revoke')}>
          {busy === 'revoke' ? 'Taking it back…' : 'Take it back'}
        </button>
      </div>
      <Facts rows={lookupRows(said)} />
      {signInHelp(said).confirm || signInHelp(said).reset ? (
        <div className="history-actions">
          {signInHelp(said).confirm ? (
            <button type="button" className="chip" disabled={!!busy} onClick={() => help('confirm')}>
              {busy === 'confirm' ? 'Sending…' : 'Resend their "confirm your email" link'}
            </button>
          ) : null}
          {signInHelp(said).reset ? (
            <button type="button" className="chip" disabled={!!busy} onClick={() => help('reset')}>
              {busy === 'reset' ? 'Sending…' : 'Send them a password reset'}
            </button>
          ) : null}
        </div>
      ) : null}
      {helped ? (
        <p className={helped.ok ? 'hint access-said' : 'save-error access-said'} role="status">
          {helped.message}
        </p>
      ) : null}
    </div>
  )
}
