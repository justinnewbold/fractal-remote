import { useEffect, useState } from 'react'
import { confirmWithCode, loadRemoteConfig, NOT_IN_INBOX, resendConfirmation, sendPasswordReset, sentAgain } from '../lib/remote'
import { CONFIRMED_SIGN_IN } from '../../shared/confirm-code.mjs'

/**
 * The one sign-in form.
 *
 * There were three: one to connect a phone, a second to sign the Mac's
 * device server in, and an account panel that could reset a password but not
 * sign anyone in at all. Same account, same two fields, three places to type
 * them. This is the form; what happens on submit is the caller's.
 *
 * CREATE IS HERE WHERE THE CALLER ASKS FOR IT, and it was not, once.
 *
 * It used to be refused outright: "do not allow an account to be created on
 * any of the desktop or the web app version, only sign-ins." That was
 * written when the phone was the only end that could take money, and an
 * account made here would have been the free half of something whose paid
 * half lived on a handset.
 *
 * The browser and the computer app sell the unlock now, and a purchase has
 * to belong to an account — so somebody who has never had the phone app
 * could not buy at all. "That was old info before we decided to do
 * purchases on the web, so yes, somebody should be able to create an account
 * on the web and desktops, and make purchases as well."
 *
 * So `onCreate` turns it on, and a caller with nothing to sell leaves it
 * off. The words are the phone's: Create Account, and I already have one.
 *
 * Forgot stays: somebody signing in here with an account made on their phone
 * is exactly the person who will have forgotten the password.
 */
export default function SignIn({
  email: initial = '',
  submitLabel = 'Sign in',
  onSubmit,
  onCreate,
  startIn = 'in',
  /* Told which side the form is on, so the sheet around it can say so in its title. */
  onMode,
  busy,
  autoFocus,
  /*
   * 'stage' is his mockup of the first screen: a picture in each field and no
   * label over it, Sign in full width, then Create account and Forgot
   * password side by side — the phone's sign-in screen, drawn the same.
   * Anything else is the form as the sheets have always shown it.
   */
  variant
}) {
  const stage = variant === 'stage'
  /* Opened by a Create Account button, the form starts on making one. */
  const [mode, setMode] = useState(onCreate && startIn === 'up' ? 'up' : 'in') // 'in' | 'up' | 'forgot' | 'sent'
  useEffect(() => {
    onMode?.(mode)
  }, [mode, onMode])
  const [email, setEmail] = useState(initial)
  const [password, setPassword] = useState('')
  const [working, setWorking] = useState(false)
  const [note, setNote] = useState(null)
  const [problem, setProblem] = useState(null)
  /*
   * The address Sign in was refused for because its email was never
   * confirmed: Send it again shows, and sends to it rather than to whatever
   * the box says by then. The account service can answer "sent" for an
   * address with no account, and the "look in Spam" line would follow it.
   *
   * And the address an account was just made for, on the Account made
   * screen, because the box for the email's CODE waits on both: the phone's
   * second way past the confirmation email, for the one new customer in
   * seven who never tapped its link. See confirm, below.
   */
  const [unconfirmed, setUnconfirmed] = useState(null)
  const [code, setCode] = useState('')
  const [confirming, setConfirming] = useState(false)

  const off = busy || working
  const project = () => {
    const c = loadRemoteConfig() || {}
    return { url: c.url, anonKey: c.anonKey }
  }

  const go = async (e) => {
    e?.preventDefault?.()
    setProblem(null)
    setNote(null)
    setUnconfirmed(null)
    const address = email.trim()
    if (!address) return setProblem('Enter your email.')
    if (mode !== 'forgot' && password.length < 6) return setProblem('Your password is at least 6 characters.')
    setWorking(true)
    try {
      if (mode === 'in') {
        await onSubmit({ email: address, password })
      } else if (mode === 'up') {
        const { needsConfirmation } = await onCreate({ email: address, password })
        /*
         * THE EMAIL, AS A SCREEN OF ITS OWN. "When I did sign up and I clicked
         * create account, it didn't give me any confirmation that I need to
         * check my email or that account was created." It did — as one grey
         * line under the buttons, below a phone's keyboard. Now the form gives
         * way to it. The words are still the phone's.
         */
        if (needsConfirmation) {
          setUnconfirmed(address)
          setMode('sent')
        }
      } else {
        await sendPasswordReset({ ...project(), email: address, redirectTo: window.location.origin })
        setNote('If that address has an account, a reset link is on its way.')
        setMode('in')
      }
    } catch (err) {
      setProblem(err.message)
      setUnconfirmed(mode === 'in' && err?.notConfirmed ? address : null)
    } finally {
      setWorking(false)
    }
  }

  /*
   * SEND IT AGAIN, from the refusal itself. "Email not confirmed" said to
   * look for the email and offered no way to get another one.
   */
  const sendAgain = async () => {
    const address = unconfirmed
    if (!address) return
    setProblem(null)
    setNote(null)
    setWorking(true)
    /* Still waiting once it has gone, on a new email with a new code: the
       box for it stays, and the old code goes out of it. */
    try {
      await resendConfirmation({ ...project(), email: address })
      setCode('')
      setNote(sentAgain(address))
    } catch (err) {
      setProblem(err.message)
    } finally {
      setWorking(false)
    }
  }

  /*
   * THE CODE FROM THE EMAIL, the second way past it, as on the phone.
   *
   * A good code confirms the account, and then this is a sign-in like any
   * other: the caller's own onSubmit, with the email it was confirmed for
   * and the password still in the form, so whatever errand the form was
   * opened for — connect this phone, turn the computer's phone remote on —
   * is done exactly as Sign in does it. With no password left in the form
   * there is nothing to sign in with, and it says so.
   */
  const confirm = async () => {
    const address = unconfirmed
    if (!address) return
    setProblem(null)
    setNote(null)
    setWorking(true)
    setConfirming(true)
    try {
      await confirmWithCode({ ...project(), email: address, code })
    } catch (err) {
      setProblem(err.message)
      setConfirming(false)
      setWorking(false)
      return
    }
    setConfirming(false)
    setUnconfirmed(null)
    setCode('')
    setEmail(address)
    setMode('in')
    try {
      if (password.length >= 6) await onSubmit({ email: address, password })
      else setNote(CONFIRMED_SIGN_IN)
    } catch (err) {
      setProblem(err.message)
    } finally {
      setWorking(false)
    }
  }

  /* On the Sign in side and on Account made: Create account and Forgot keep the refusal on screen, not its button. */
  const waiting = (mode === 'in' || mode === 'sent') && unconfirmed
  const again =
    waiting && problem ? (
      <button type="button" className="chip signin-wide" onClick={sendAgain} disabled={off}>
        Send the confirmation email again
      </button>
    ) : null
  /*
   * The box for the code, wherever an account waits. Enter confirms rather
   * than submitting the form around it, which would try the sign-in that
   * was just refused. On Account made it is the main thing to do; under
   * a refusal, Sign in still is.
   */
  const codeBox = waiting ? (
    <div className="signin-code">
      <label className="signin-field">
        <span>Code from the email</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (!off) confirm()
          }}
          disabled={off}
        />
      </label>
      <button
        type="button"
        className={mode === 'sent' ? 'primary signin-wide' : 'chip signin-wide'}
        onClick={confirm}
        disabled={off}
      >
        {confirming ? 'Confirming…' : 'Confirm account'}
      </button>
    </div>
  ) : null

  if (mode === 'sent') {
    return (
      <div className="signin signin-sent" role="status">
        <span className="signin-sent-mark" aria-hidden="true">
          ✉
        </span>
        <p className="signin-sent-head">Account made.</p>
        <p className="signin-sent-body">
          Type the code from the email we just sent in the box below, or tap the link in that email and then sign in. {NOT_IN_INBOX}
        </p>
        <p className="signin-sent-to">
          <strong>{email.trim()}</strong>
        </p>
        {problem ? (
          <p className="problem" role="alert">
            {problem}
          </p>
        ) : null}
        {again}
        {note ? <p className="hint">{note}</p> : null}
        {codeBox}
        <button className="chip signin-wide" type="button" onClick={() => setMode('in')} disabled={off}>
          Sign in
        </button>
      </div>
    )
  }

  if (stage) {
    return (
      <form className="signin signin-stage" onSubmit={go}>
        <label className="signin-iconfield">
          <FieldIcon kind="mail" />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus={autoFocus}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={off}
            placeholder="Email"
            aria-label="Email"
          />
        </label>
        {mode !== 'forgot' ? (
          <label className="signin-iconfield">
            <FieldIcon kind="lock" />
            <input
              type="password"
              autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={off}
              placeholder="Password"
              aria-label="Password"
            />
          </label>
        ) : null}
        {problem ? (
          <p className="problem" role="alert">
            {problem}
          </p>
        ) : null}
        {again}
        {note ? <p className="hint">{note}</p> : null}
        {codeBox}
        <button className="primary signin-wide signin-go" type="submit" disabled={off}>
          {working
            ? 'One moment…'
            : mode === 'forgot'
              ? 'Email me a reset link'
              : mode === 'up'
                ? 'Create account'
                : submitLabel}
        </button>
        <div className="signin-pair">
          {mode === 'in' ? (
            <>
              {onCreate ? (
                <button type="button" className="chip" onClick={() => setMode('up')} disabled={off}>
                  Create account
                </button>
              ) : null}
              <button type="button" className="chip" onClick={() => setMode('forgot')} disabled={off}>
                Forgot password?
              </button>
            </>
          ) : (
            <button type="button" className="chip" onClick={() => setMode('in')} disabled={off}>
              {mode === 'up' ? 'I already have one' : 'Back to sign in'}
            </button>
          )}
        </div>
      </form>
    )
  }

  return (
    <form className="signin" onSubmit={go}>
      <label className="signin-field">
        <span>Email</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={off}
          placeholder="you@example.com"
        />
      </label>
      {mode !== 'forgot' ? (
        <label className="signin-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={off}
          />
        </label>
      ) : null}

      <div className="signin-actions">
        <button className="primary" type="submit" disabled={off}>
          {working
            ? 'One moment…'
            : mode === 'forgot'
              ? 'Email me a reset link'
              : mode === 'up'
                ? 'Create account'
                : submitLabel}
        </button>
        {/*
          THE OTHER SIDE OF THE FORM, as a button the size of the one above it.
          "When it says create account, it's in a very tiny font underneath
          where it says sign in. Most people coming here for the first time
          are going to be creating an account." A link-sized Create Account
          was the thing a first-timer most needed and was least likely to see.
        */}
        {mode === 'up' ? (
          <button type="button" className="chip signin-wide" onClick={() => setMode('in')} disabled={off}>
            I already have one
          </button>
        ) : mode === 'in' && onCreate ? (
          <button type="button" className="chip signin-wide" onClick={() => setMode('up')} disabled={off}>
            Create account
          </button>
        ) : null}
        {mode === 'in' ? (
          <button type="button" className="signin-link" onClick={() => setMode('forgot')} disabled={off}>
            Forgot password?
          </button>
        ) : null}
        {mode === 'forgot' ? (
          <button type="button" className="signin-link" onClick={() => setMode('in')} disabled={off}>
            Back to sign in
          </button>
        ) : null}
      </div>

      {problem ? (
        <p className="problem" role="alert">
          {problem}
        </p>
      ) : null}
      {again}
      {note ? <p className="hint">{note}</p> : null}
      {codeBox}
    </form>
  )
}

/** The envelope and the padlock in the mockup's fields, drawn in the field's own ink. */
function FieldIcon({ kind }) {
  return (
    <svg
      className="signin-fieldicon"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'mail' ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </>
      ) : (
        <>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </>
      )}
    </svg>
  )
}
