import { useEffect, useReducer } from 'react'
import { ASK_EVERY_MS, computerCheck } from '../../shared/no-computer.mjs'
import { accountHasComputer, remoteUserId, subscribeHostSeen } from './remote'

/*
 * The browser's half of "No computer is signed in with this account yet":
 * one memory for the whole page, as the phone keeps one for its whole run
 * (mobile/src/lib/useNoComputer.js). See shared/no-computer.mjs for the rule.
 *
 * A computer answering on the relay is a yes without asking anybody.
 */
const check = computerCheck(accountHasComputer)
subscribeHostSeen((up) => {
  if (up) check.seen(remoteUserId())
})

/* Often enough that a timer firing a moment early does not cost a whole
   extra minute; the check itself decides whether a minute has gone. */
const POKE_MS = ASK_EVERY_MS / 4

/**
 * { email } when no computer has ever signed in with `account`, for certain;
 * null for everything else. Asked only while `active`: the connect screen and
 * Setup turn it on at the moment they say "make sure the computer is awake",
 * once the account warning has answered no, and never for a pairing code's
 * account.
 */
export function useNoComputer(active, account) {
  const id = active && account?.id ? account.id : null
  const email = account?.email || ''
  const [, redraw] = useReducer((n) => n + 1, 0)
  useEffect(() => check.subscribe(redraw), [])
  useEffect(() => {
    if (!id) return undefined
    const poke = () => check.poke({ id, email })
    poke()
    const t = setInterval(poke, POKE_MS)
    return () => clearInterval(t)
  }, [id, email])
  return id ? check.none(id) : null
}
