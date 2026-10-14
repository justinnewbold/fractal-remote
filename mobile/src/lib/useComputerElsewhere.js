import { useEffect, useState } from 'react'

import { computerElsewhere } from './relay'

/**
 * Whether a computer on this wifi is signed into a different account, asked
 * while `active` and again every half minute, because the answer changes the
 * moment somebody signs the computer in again. See relay.js.
 *
 * Null until the first answer, then true or false. The account warning reads
 * it as before (null is not a yes); "No computer is signed in with this
 * account yet" waits for a false, so it never comes up a moment before the
 * account warning replaces it.
 */
export function useComputerElsewhere(active, everyMs = 30000) {
  const [elsewhere, setElsewhere] = useState(null)
  useEffect(() => {
    if (!active) {
      setElsewhere(null)
      return undefined
    }
    let live = true
    const ask = () => computerElsewhere().then((yes) => live && setElsewhere(yes))
    ask()
    const t = setInterval(ask, everyMs)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [active, everyMs])
  return elsewhere
}
