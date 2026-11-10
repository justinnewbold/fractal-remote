import { useEffect, useRef, useState } from 'react'
import { keepPlayShare, readPlayShare } from './sidesKeep'

/**
 * WHERE THE LINE BETWEEN THE TWO SIDES WAS DRAGGED TO (lib/sidesSplit), for
 * App.js: Play's share of the window, read back from last time, kept at each
 * drag, and put back where the window has it by two taps on the handle or
 * by turning the device (`big` going from true to false: an iPad turned
 * upright shows one side, and comes back to its own split).
 *
 * `allowed` is whether the handle is open to this account at all (his,
 * until features TIDY_EDIT_FOR_EVERYONE). Not allowed: `share` is null
 * whatever was kept, nothing is read, and the two sides are where they
 * always were.
 */
export function useSidesSplit({ allowed = false, big = false } = {}) {
  const [share, setShare] = useState(null)
  useEffect(() => {
    if (!allowed) return undefined
    let alive = true
    readPlayShare().then((kept) => alive && kept !== null && setShare(kept))
    return () => {
      alive = false
    }
  }, [allowed])
  /* Turned: only on the change from a big screen to not one, never at launch, when nothing has been measured and `big` is still false. */
  const wasBig = useRef(false)
  useEffect(() => {
    if (wasBig.current && !big && allowed) {
      setShare(null)
      keepPlayShare(null)
    }
    wasBig.current = big
  }, [big, allowed])
  return {
    allowed,
    share: allowed ? share : null,
    set: (next) => {
      setShare(next)
      keepPlayShare(next)
    },
    reset: () => {
      setShare(null)
      keepPlayShare(null)
    }
  }
}
