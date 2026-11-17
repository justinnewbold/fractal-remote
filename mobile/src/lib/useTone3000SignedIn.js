/*
 * WHETHER A TONE3000 SIGN-IN IS KEPT ON THIS DEVICE, for Settings' TONE3000
 * row (lib/tone3000Words), and the way to sign out of it. Asked each time
 * Settings' front list comes up (`front`), so a sign-in made on a held NAM
 * block or in Edit is there when Settings is opened next.
 */
import { useCallback, useEffect, useState } from 'react'
import { signOutHere, tone3000Who } from './tone3000Here'

const NOBODY = Object.freeze({ signedIn: false, name: null })

export function useTone3000SignedIn(front) {
  const [who, setWho] = useState(NOBODY)
  useEffect(() => {
    if (!front) return undefined
    let alive = true
    tone3000Who()
      .then((w) => {
        if (alive) setWho(w || NOBODY)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [front])
  /* Throws where the device would not let go of the pass: the row stays, and Settings says so. */
  const signOut = useCallback(async () => {
    await signOutHere()
    setWho(NOBODY)
  }, [])
  return { ...who, signOut }
}
