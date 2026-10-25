import { useLayoutEffect, useState } from 'react'
import { STEP_LINE_LEAST, fitLine } from '../../shared/line-fit.mjs'

/**
 * The line under Previous and Next, drawn smaller rather than cut: the
 * browser's half of shared/line-fit.mjs (which says why), the phone's being
 * Press `fit`.
 *
 * Measured with a canvas in the line's own face and size, as the stylesheet
 * draws it; the room is the line's own width, which the stylesheet makes the
 * button's less 4px at each edge. A size is handed back only when the name
 * needs one, so a name that fits is drawn by the stylesheet as it always was.
 */

let canvas = null
/* Widths already measured, kept only once the face itself has loaded (see sceneNameFit's WIDTHS for why). */
const WIDTHS = new Map()

function widthOf(text, font) {
  const key = `${font}|${text}`
  if (WIDTHS.has(key)) return WIDTHS.get(key)
  canvas = canvas || document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = font
  const w = ctx.measureText(text).width
  if (document.fonts?.check?.(font) !== false) WIDTHS.set(key, w)
  return w
}

/**
 * The size in px to draw the line in `ref` at, for `text`, or null for the
 * stylesheet's own. Measured again when the text changes, when the line
 * changes width, and once the page's fonts have loaded.
 */
export function useStepLineSize(ref, text) {
  const [size, setSize] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof getComputedStyle !== 'function') return undefined
    let raf = 0
    const measure = () => {
      /* The stylesheet's size, not one this set: read with the line's own size taken off for the moment. */
      const was = el.style.fontSize
      el.style.fontSize = ''
      const css = getComputedStyle(el)
      const base = parseFloat(css.fontSize) || 0
      const font = `${css.fontStyle} ${css.fontWeight} ${base}px ${css.fontFamily}`
      const room = el.clientWidth
      el.style.fontSize = was
      const fit = fitLine({ natural: text ? widthOf(text, font) : 0, room, size: base, least: STEP_LINE_LEAST })
      const next = fit.size > 0 && fit.size !== base ? fit.size : null
      setSize((s) => (s === next ? s : next))
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    measure()
    const sized = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
    sized?.observe(el)
    let alive = true
    const fresh = () => {
      if (!alive) return
      WIDTHS.clear()
      schedule()
    }
    document.fonts?.ready?.then(fresh)
    document.fonts?.addEventListener?.('loadingdone', fresh)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      sized?.disconnect()
      document.fonts?.removeEventListener?.('loadingdone', fresh)
    }
  }, [ref, text])
  return size
}
