import { useRef, useState } from 'react'

import { sceneColor } from '../lib/sceneColors'
import { swapScenes } from '../lib/gigSize'

/**
 * ARRANGE SCENES: HOLD ONE, DRAG IT ONTO ANOTHER, AND THEY SWAP.
 *
 * "Can you make it so you can grab and drop the scenes wherever you want them
 * on the screen? Because that would be cool." On the Appearance page, never on
 * Play — a slip on the stage must change the scene, not move it. The phone's
 * Appearance page has the same grid (mobile/src/components/SceneArrange).
 *
 * Two columns of eight numbered tiles, in the colours Play gives them. Pointer
 * events, so a mouse and a finger on a touch screen drag the same way; the
 * places are measured when the drag starts, and the drop lands on whichever
 * one the pointer is over. A drop swaps two places rather than shuffling the
 * rest along: one change to check afterwards, not eight.
 */
export default function SceneArrange({ order, onChange }) {
  const [drag, setDrag] = useState(null)
  const places = useRef([])
  const held = useRef(null)
  const show = (d) => {
    held.current = d
    setDrag(d)
  }

  const overAt = (x, y) => {
    const k = places.current.findIndex((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
    return k >= 0 ? k : null
  }

  const down = (k) => (e) => {
    if (e.button !== undefined && e.button !== 0) return
    const grid = e.currentTarget.parentElement
    places.current = [...grid.querySelectorAll('[data-place]')].map((el) => el.getBoundingClientRect())
    e.currentTarget.setPointerCapture?.(e.pointerId)
    show({ from: k, over: k, x: e.clientX, y: e.clientY, dx: 0, dy: 0 })
  }
  const move = (e) => {
    const d = held.current
    if (!d) return
    show({ ...d, dx: e.clientX - d.x, dy: e.clientY - d.y, over: overAt(e.clientX, e.clientY) })
  }
  const up = (dropped) => () => {
    const d = held.current
    show(null)
    if (dropped && d && d.over !== null && d.over !== d.from) onChange(swapScenes(order, d.from, d.over))
  }

  return (
    <div className="scene-arrange" role="group" aria-label="Arrange scenes">
      {order.map((scene, k) => {
        const carried = drag?.from === k
        const target = !!drag && !carried && drag.over === k
        return (
          <div
            key={scene}
            data-place={k}
            className={`scene-arrange-tile ${carried ? 'carried' : ''} ${target ? 'target' : ''}`}
            style={{
              '--scene-fill': sceneColor(scene).fill,
              '--scene-ink': sceneColor(scene).ink,
              transform: carried ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined
            }}
            aria-label={`Scene ${scene + 1}, place ${k + 1}`}
            onPointerDown={down(k)}
            onPointerMove={move}
            onPointerUp={up(true)}
            onPointerCancel={up(false)}
          >
            <span className="scene-arrange-word">Scene</span>
            <span className="scene-arrange-num mono">{scene + 1}</span>
          </div>
        )
      })}
    </div>
  )
}
