import { useEffect, useState } from 'react'
import { holdLink } from './link'

/**
 * The link as the top bar says it: the phone's useHeldLink (mobile/App.js),
 * over the step in link.js that can be tested (holdLink).
 *
 * Once a stretch of looking for the computer has gone unanswered, the bar
 * keeps saying Disconnected until the computer is back, instead of flicking
 * to Connecting at every retry. Only the bar reads it: everything else still
 * follows the link as it is.
 */
export function useHeldLink(link) {
  const [missed, setMissed] = useState(false)
  const held = holdLink(link, missed)
  useEffect(() => {
    if (held.missed !== missed) setMissed(held.missed)
  }, [held.missed, missed])
  return held.shown
}
