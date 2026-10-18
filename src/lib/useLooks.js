import { useSyncExternalStore } from 'react'
import { loadLooks, lookId, looksVersion, watchLooks } from './looks.js'

/**
 * Re-render when the colours change.
 *
 * The phone repaints from its root, beside the theme; the browser has no such
 * root to lean on, so each component that asks blockColor or sceneColor what
 * a tile is subscribes here — Play, the edit strip, the rows and the scene
 * order. One line each, and a look picked in Settings repaints them at once
 * rather than the next time something else happens to draw them.
 *
 * Browser only: the phone's copy of lib/looks has no React in it.
 */
export const useLooks = () => useSyncExternalStore(watchLooks, looksVersion, looksVersion)

/**
 * Read the colours at start, beside the theme, and say on the page which
 * look is worn — `data-look` on <html>, next to `data-theme` — so the
 * stylesheet can leave Fractal Remote drawn exactly as it always was (its
 * edges, its gradients) while the other looks get theirs.
 */
export function startLooks() {
  loadLooks()
  const show = () => {
    try {
      document.documentElement.dataset.look = lookId()
    } catch {
      /* no document: nothing to mark */
    }
  }
  show()
  return watchLooks(show)
}
