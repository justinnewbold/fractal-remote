import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

import { chromeSolid } from './glass'
import { lookId } from './looks'
import { setSolidChrome } from './theme'

/**
 * The glass drawn solid when it should be, asked once at the root.
 *
 * Two things ask for it (lib/glass chromeSolid): the Sunlight look, chosen in
 * Settings → Colors for reading on a bright stage, and an iPhone set to
 * Reduce Transparency, which says so here and again whenever it changes.
 * Android never reports that setting, so there it is Sunlight alone. On an
 * iPhone the blur views go solid under Reduce Transparency by themselves;
 * this does the same for the glass that is only a see-through fill.
 *
 * The look is read on every render rather than watched, because App already
 * re-renders on a change of look. Setting it repaints the theme in place,
 * and the theme watcher at the root draws the whole tree again.
 */
export function useSolidChrome() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let live = true
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((v) => live && setReduce(Boolean(v)))
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v) => setReduce(Boolean(v)))
    return () => {
      live = false
      sub?.remove?.()
    }
  }, [])
  const solid = chromeSolid({ look: lookId(), reduceTransparency: reduce })
  useEffect(() => {
    setSolidChrome(solid)
  }, [solid])
  return solid
}
