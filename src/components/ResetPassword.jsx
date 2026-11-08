import { useMemo, useState } from 'react'

import { NOT_AFFILIATED } from '../../shared/affiliation.mjs'
import {
  makeReset,
  resetFor,
  RESET_AGAIN,
  RESET_DONE,
  RESET_DONE_TITLE,
  RESET_EXPIRED,
  RESET_EXPIRED_TITLE,
  RESET_FIELD,
  RESET_HINT,
  RESET_LASTS,
  RESET_SAVE,
  RESET_SAVING,
  RESET_SHOW,
  RESET_TITLE,
  RESET_TO_SIGN_IN,
  RESET_TO_SITE,
  SITE_HOME
} from '../lib/recovery'

/**
 * CHOOSE A NEW PASSWORD: THE PAGE THE RESET EMAIL'S LINK OPENS.
 *
 * "I received the link to reset my password but when I clicked it, it did
 * not ever take me to a page where I can actually make the password change."
 * (a customer, 8 November 2026.) This is that page.
 *
 * Drawn by src/main.jsx in the app's place, for the one visit the link
 * opens (lib/recoveryLanding.js): a whole page, the site's own look, and
 * nothing else on it. Not over the app, because nothing of the app runs
 * under it: not its sign-in, which would take the link's sign-in as this
 * browser's; not the startup card or the walkthrough, which would cover it;
 * not the update check, whose reload would lose it. The startup card, owed
 * to a first visit, comes on the next one, when the website opens as
 * itself; Fractal Audio's sentence is at the foot of this one meanwhile.
 *
 * Three states. The boxes, for a link that brought a sign-in: the new
 * password twice, Show password, Save. Password changed, once it is, with
 * the way to sign in. And This link has expired, for a link the account
 * service turned down (old, or used already), or a save it turned down for
 * the same reason, with what to do instead. The save and every word are
 * lib/recovery.js's.
 *
 * One column at the walkthrough's width, held to the screen with a 16px
 * gutter, so a phone's browser shows all of it and its keyboard does not
 * hide Save (the page scrolls).
 */
export default function ResetPassword({ landing, go = (to) => window.location.replace(to) }) {
  const [state, setState] = useState(landing?.kind === 'recovery' ? 'form' : 'expired') // 'form' | 'done' | 'expired'
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState(null)
  const reset = useMemo(() => makeReset({ landing }), [landing])

  const save = async (e) => {
    e?.preventDefault?.()
    if (working) return
    setProblem(null)
    setWorking(true)
    const said = await reset.save(password, again)
    setWorking(false)
    if (said.ok) {
      setPassword('')
      setAgain('')
      setState('done')
    } else if (said.expired) {
      setState('expired')
    } else {
      setProblem(said.problem)
    }
  }

  const foot = <p className="reset-small">{NOT_AFFILIATED}</p>

  if (state === 'done') {
    return (
      <main className="reset" aria-labelledby="reset-title">
        <div className="reset-card" role="status">
          <h1 id="reset-title" className="reset-title">
            {RESET_DONE_TITLE}
          </h1>
          <p className="reset-words">{RESET_DONE}</p>
          <button type="button" className="primary reset-go" autoFocus onClick={() => go(SITE_HOME)}>
            {RESET_TO_SIGN_IN}
          </button>
          {foot}
        </div>
      </main>
    )
  }

  if (state === 'expired') {
    return (
      <main className="reset" aria-labelledby="reset-title">
        <div className="reset-card" role="alert">
          <h1 id="reset-title" className="reset-title">
            {RESET_EXPIRED_TITLE}
          </h1>
          <p className="reset-words">{RESET_EXPIRED}</p>
          <p className="reset-for">{RESET_LASTS}</p>
          <button type="button" className="chip reset-go" onClick={() => go(SITE_HOME)}>
            {RESET_TO_SITE}
          </button>
          {foot}
        </div>
      </main>
    )
  }

  const who = resetFor(landing?.email)
  return (
    <main className="reset" aria-labelledby="reset-title">
      <form className="reset-card" onSubmit={save} noValidate>
        <h1 id="reset-title" className="reset-title">
          {RESET_TITLE}
        </h1>
        {who ? <p className="reset-for">{who}</p> : null}
        {/* The account's email, unseen, so a password manager saves the new password against the right account. */}
        {landing?.email ? <input type="email" autoComplete="username" value={landing.email} readOnly hidden /> : null}
        <label className="signin-field">
          <span>{RESET_FIELD}</span>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={working}
          />
        </label>
        <label className="signin-field">
          <span>{RESET_AGAIN}</span>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            disabled={working}
          />
        </label>
        <label className="reset-show">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          <span>{RESET_SHOW}</span>
        </label>
        <p className="hint reset-hint">{RESET_HINT}</p>
        {problem ? (
          <p className="problem" role="alert">
            {problem}
          </p>
        ) : null}
        <button type="submit" className="primary reset-go" disabled={working}>
          {working ? RESET_SAVING : RESET_SAVE}
        </button>
        {foot}
      </form>
    </main>
  )
}
