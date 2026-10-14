import { useEffect, useReducer, useState } from 'react'

import { ASK_EVERY_MS, computerCheck } from './no-computer'
import { isPairAccount } from './pairing'
import { accountHasComputer, remoteUserId, sessionAccount, subscribeHostSeen } from './relay'

/*
 * ONE MEMORY FOR THE WHOLE RUN, so a yes is kept across every screen and the
 * once-a-minute limit holds however many screens ask. See shared/no-computer.mjs.
 *
 * And a computer answering on the relay is a yes without asking anybody: it
 * is a computer signed in with this account, right there.
 */
const check = computerCheck(accountHasComputer)
subscribeHostSeen((up) => {
  if (up) check.seen(remoteUserId())
})

/* How often a stretch of looking pokes the check. The check itself decides
   whether a minute has gone; this only has to come round often enough that
   a timer firing a moment early does not cost a whole extra minute. */
const POKE_MS = ASK_EVERY_MS / 4

/**
 * Whether no computer has ever signed in with this phone's account, asked
 * only while `active`: { email } for a definite no, null for everything else.
 *
 * App asks it once the computer has been looked for fifteen seconds with no
 * answer (useLookedLong) and the phone is not on Bluetooth (beta), in the
 * demo, or signed out — the moment "make sure the computer is awake" comes up
 * — and hands the answer to the screens that say that. A pairing code's
 * account is never asked about: a computer made it, and its email is not
 * one anybody could sign in with.
 */
export function useNoComputer(active) {
  /*
   * WHOSE ACCOUNT, as this stretch of looking has read it off the phone, and
   * nobody's until it has. It is forgotten the moment the looking stops, so
   * the next stretch starts from nobody: App never goes away, and across a
   * sign-out and somebody else signing in, a `who` kept from before would
   * hand the new account the old one's "No computer is signed in", naming
   * the old email, for as long as the phone took to read its own session —
   * which with bad signal at a gig can be seconds.
   */
  const [who, setWho] = useState(null)
  const [, redraw] = useReducer((n) => n + 1, 0)
  useEffect(() => check.subscribe(redraw), [])
  useEffect(() => {
    if (!active) {
      setWho(null)
      return undefined
    }
    let live = true
    const poke = async () => {
      const me = await sessionAccount()
      if (!live) return
      const real = me && !isPairAccount(me.email) ? me : null
      setWho(real ? real.id : null)
      if (real) await check.poke(real)
    }
    poke()
    const t = setInterval(poke, POKE_MS)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [active])
  return active && who ? check.none(who) : null
}
