import { useLayoutEffect, useState } from 'react'
import { NAME_MAX, NAME_REF, fitName, together } from '../../shared/name-fit.mjs'

/**
 * Play's scene names, as big as each tile has room for: the browser's half
 * of shared/name-fit.mjs (which says why), the phone's being its Tile.
 *
 * Measured with a canvas in the name's own face, upper case as it is drawn,
 * with its letter spacing, at NAME_REF; the room is each tile's: its width,
 * and the height it is given (its min-height, or on the compact Play, where
 * a tile is a stated box, its height) less its padding, border, the number
 * above the name and the gap between them. A name never grows the tile, so
 * the fit that sized the tiles still holds.
 *
 * One size for the grid (`together`): every name that fits takes the
 * smallest size that fits them all. When one name does not fit even at the
 * floor, none is given a size, and the styles draw the whole grid as they
 * always did (the compact Play's smaller sizes and its one-line clamp
 * included), so the grid is never two sizes at once.
 */

/* The browser's own letter spacing for a scene name (styles.css, .gig-scene-name), a share of the size. */
const TRACK = 0.05
/* Its line height (button.gig-scene.named .gig-scene-name). */
const LINE = 1.15
/*
 * The floor: the smallest a scene's name was ever drawn at on Play (--f-2,
 * a four-across phone). Not --f-4, the usual size: with that floor a name
 * too long for it fell back to the compact Play's smaller size beside names
 * fitted bigger, two sizes in one grid again. From here the whole grid comes
 * down together, as far as the longest name needs.
 */
export const NAME_FLOOR = 12

let canvas = null
/*
 * Widths already measured, kept only once the face itself has loaded: a
 * width taken in the fallback face while the page's font was still on its
 * way was kept for good, so the measure again when the fonts arrived changed
 * nothing and a name stayed the wrong size (too big, and cut, where the
 * fallback is narrower) until the page was reloaded. Emptied whenever fonts
 * finish loading, too (useSceneNameSizes).
 */
const WIDTHS = new Map()

/* One run of text's width at NAME_REF, letter spacing included: a space after every letter, the way CSS draws it. */
function widthOf(text, family) {
  const key = `${family}|${text}`
  if (WIDTHS.has(key)) return WIDTHS.get(key)
  canvas = canvas || document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = `700 ${NAME_REF}px ${family}`
  const w = ctx.measureText(text).width + [...text].length * TRACK * NAME_REF
  if (document.fonts?.check?.(ctx.font) !== false) WIDTHS.set(key, w)
  return w
}

/** A name's measure, as shared/name-fit takes it, or null. */
export function measureName(name, { family, upper = true } = {}) {
  const shown = upper ? String(name || '').toUpperCase() : String(name || '')
  const words = shown.trim().split(/\s+/).filter(Boolean)
  if (!words.length || !family) return null
  const widths = words.map((w) => widthOf(w, family))
  if (!widths.every((w) => w > 0)) return null
  return { words: widths, space: widthOf(' ', family), line: LINE * NAME_REF }
}

const px = (v) => parseFloat(v) || 0

/**
 * The size for each scene's name, by scene index, from the tiles as drawn:
 * an array with a number for a fitted name and null for one drawn as before.
 * Measured again when the names change and when the grid changes size, and
 * once the page's fonts have loaded (a measure in the fallback face would
 * be the wrong width).
 */
export function useSceneNameSizes(gridRef, names, count) {
  const [sizes, setSizes] = useState([])
  const key = (names || []).join('\u0000')
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return undefined
    let raf = 0
    const measure = () => {
      const each = []
      for (const button of grid.querySelectorAll('button.gig-scene[data-scene]')) {
        const i = Number(button.dataset.scene)
        const nameEl = button.querySelector('.gig-scene-name')
        const numEl = button.querySelector('.gig-scene-num')
        if (!nameEl || !Number.isInteger(i)) continue
        const css = getComputedStyle(button)
        const face = getComputedStyle(nameEl)
        const got = measureName(names?.[i], { family: face.fontFamily, upper: face.textTransform === 'uppercase' })
        if (!got) continue
        const tall = px(css.minHeight) || button.offsetHeight
        each[i] = fitName({
          ...got,
          ref: NAME_REF,
          width: button.clientWidth - px(css.paddingLeft) - px(css.paddingRight),
          height:
            tall -
            px(css.borderTopWidth) -
            px(css.borderBottomWidth) -
            px(css.paddingTop) -
            px(css.paddingBottom) -
            (numEl ? numEl.offsetHeight + px(css.rowGap) : 0),
          min: NAME_FLOOR,
          max: NAME_MAX
        })
      }
      const one = together(each)
      const next = each.map((f) => (one && f?.fits ? one : null))
      setSizes((was) => (was.length === next.length && was.every((s, i) => s === next[i]) ? was : next))
    }
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    measure()
    const sized = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null
    sized?.observe(grid)
    let alive = true
    /* Once the fonts are in, every width again, in the face itself. */
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
  }, [gridRef, key, count])
  return sizes
}
