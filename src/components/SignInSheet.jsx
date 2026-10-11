import { useState } from 'react'
import Sheet from './Sheet'
import SignIn from './SignIn'

/**
 * Sign-in as a sheet: it pops up, you do the one thing, it goes.
 *
 * The same form in both roles; only the words around it differ. On a phone
 * it is "Connect to your Mac", because that is what the person is doing —
 * the account is the means. At the Mac it is "Set up phone remote", once.
 */
export default function SignInSheet({ open, role, account = false, startIn = 'in', forUnlock = false, email, busy, onClose, onSubmit, onCreate }) {
  const phone = role !== 'mac'
  /*
   * WHICH SIDE THE FORM IS ON, so the title says what is being done. Opened
   * from Create Account it read "Connect to your computer" over a form making
   * an account — the sheet named the errand and not the step. Making an
   * account, it says so; the words about which account to use are for
   * signing in, so they wait until then.
   */
  const [side, setSide] = useState(startIn)
  const making = side === 'up' || side === 'sent'
  /*
   * A sign-in with no errand: the account and nothing else, for the demo and
   * for buying the unlock. The phone's words for it, not new ones — its
   * form's button says "Sign in", and its sign-in screen says what an
   * account is. (Its Setup button's "Sign in with an email and password"
   * was the title here first, and ran off the edge of a phone.)
   */
  if (account) {
    return (
      <Sheet open={open} onClose={onClose} title={making ? 'Create Account' : 'Sign in'}>
        <div className="signin-sheet">
          {making ? null : (
            <p className="hint">
              Sign in with the same account as the computer your unit is plugged into. Your setlists
              and starred presets follow you to any device.
            </p>
          )}
          {/*
            ON THE WAY TO THE UNLOCK, on either side of the form. Somebody who
            bought it on a phone has it already under the email they sign in
            with there, once that phone has signed in; an account made here
            with another email is a second account, and it would be sold
            again. And the phone may have no account yet at all — the buyer
            this was written for had none — so making one here says which
            email to make it with, not "the one you used there".

            SAID AS "DON'T PAY", FIRST. "…on the phone before you pay here"
            read, to somebody who had paid on the phone, as the order to do
            things in: sign in there, then pay here — the double payment this
            is here to stop. And once the account is made (`sent`), not
            "make the account" again: the next step is the phone.
          */}
          {forUnlock ? (
            <p className="hint">
              {side === 'sent'
                ? 'Bought it on your phone already? Don’t pay again here. Once you’ve confirmed the account, sign in with this email on the phone, and this unlocks by itself.'
                : making
                  ? 'Bought it on your phone already? Don’t pay again here. Make the account with the email you’ll use on the phone, then sign in with it on the phone, and this unlocks by itself.'
                  : 'Bought it on your phone already? Don’t pay again here. Sign in with the same email as on the phone. If the phone isn’t signed in yet, sign in there too, and this unlocks by itself.'}
            </p>
          ) : null}
          <SignIn
            key={startIn}
            email={email}
            busy={busy}
            autoFocus
            submitLabel="Sign in"
            onSubmit={onSubmit}
            onCreate={onCreate}
            startIn={startIn}
            onMode={setSide}
          />
        </div>
      </Sheet>
    )
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={making ? 'Create Account' : phone ? 'Connect to your computer' : 'Set up phone remote'}
      note={making ? null : phone ? 'Sign in once — this phone stays signed in' : 'Once, on this computer'}
    >
      <div className="signin-sheet">
        {/*
          WHERE THE ACCOUNT COMES FROM, said here because it cannot be made
          here. "Only sign-ins" on the computer — an account is created in
          the phone app, after the unlock, and this end signs into it.
        */}
        <p className="hint" hidden={making}>
          {phone
            ? 'Use the same account you set up on the computer.'
            : /* "Sign in with the account you made in the phone app." came
                 off the front: an account can be made on this form now. */
              'Your phone signs in with these same details to reach this computer.'}
        </p>
        <SignIn
          /* A new key when the button that opened it changes, so the form
             starts on the side that button asked for. */
          key={startIn}
          email={email}
          busy={busy}
          autoFocus
          submitLabel={phone ? 'Connect' : 'Turn on'}
          onSubmit={onSubmit}
          /* Here too: "Where is the sign-up button?" A new account made here
             goes on to do this sheet's errand — connect, or turn on. */
          onCreate={onCreate}
          startIn={startIn}
          onMode={setSide}
        />
      </div>
    </Sheet>
  )
}
