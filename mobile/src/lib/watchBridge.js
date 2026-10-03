import { useEffect, useRef } from 'react'
import { requireOptionalNativeModule } from 'expo'

import { blockColor } from './blockColors'
import { logDebug } from './debugLog'
import { idOf } from './device'
import { shortBlock } from './shortName'
import { getState, writeBypass, writeScene, writeTuner } from './rig'
import { createWatchSender, watchCommand, watchState } from './watch-link'

/*
 * THE APPLE WATCH, FROM THE PHONE'S SIDE.
 *
 * The watch draws what the phone tells it and asks for one of four things —
 * see lib/watch-link (shared/watch-link.mjs) for both halves of that. This is
 * the phone keeping its end: a fresh picture whenever the stage screen's
 * changes, and each request carried out with the same calls the stage
 * screen's own buttons make, so a scene from the wrist is the scene from the
 * screen.
 *
 * INERT UNTIL THE WATCH IS BUILT IN. The link itself is native (Apple's
 * WatchConnectivity, the FractalWatch module), and it only exists in a build
 * that carries the watch app. Without it `requireOptionalNativeModule` answers
 * null and every line below does nothing, so this can ship in an ordinary
 * update ahead of that build.
 */

let native
function link() {
  if (native !== undefined) return native
  try {
    native = requireOptionalNativeModule('FractalWatch')
  } catch {
    native = null
  }
  return native
}

/** Whether this build can talk to a watch at all. */
export const watchSupported = () => !!link()

/** A watch is paired with this phone and has the watch app on it. False on any doubt. */
export function watchPaired() {
  try {
    return link()?.isPaired?.() === true
  } catch {
    return false
  }
}

/**
 * Kept by the stage screen: `picture` is the watch's state as that screen
 * sees it now (watch-link's watchState input, with the stage's own blocks as
 * `chain`), `step(by)` its own Previous and Next, which already know the
 * setlist and the ends of the list.
 */
export function useWatchBridge(picture, step) {
  const sender = useRef(null)
  const last = useRef(null)
  const stepRef = useRef(step)
  stepRef.current = step

  /* One sender and one listener for the life of the screen. */
  useEffect(() => {
    const watch = link()
    if (!watch) return undefined
    sender.current = createWatchSender({
      send: (state, { urgent }) => watch.sendState(JSON.stringify(state), urgent)
    })
    const sub = watch.addListener?.('onCommand', (event) => {
      let msg = null
      try {
        msg = JSON.parse(event?.json || 'null')
      } catch {
        msg = null
      }
      const cmd = watchCommand(msg, last.current)
      if (!cmd) return
      logDebug('watch', cmd.do, JSON.stringify(cmd))
      if (cmd.do === 'hello') sender.current?.flush(last.current)
      else if (cmd.do === 'scene') writeScene(cmd.index)
      else if (cmd.do === 'pedal') writeBypass(cmd.id, !cmd.on)
      else if (cmd.do === 'preset') stepRef.current?.(cmd.step)
      else if (cmd.do === 'tuner') {
        if (getState().tunerOn !== cmd.on) writeTuner(cmd.on)
      }
    })
    return () => {
      sub?.remove?.()
      sender.current?.stop()
      sender.current = null
    }
  }, [])

  /* Every render of the stage screen is a chance the picture moved. */
  useEffect(() => {
    if (!sender.current) return
    const { chain, ...rest } = picture
    const pedals = (chain || []).map((b) => ({ id: idOf(b), name: b.name, short: shortBlock(b), on: !b.bypassed, ...blockColor(b.slug) }))
    const state = watchState({ ...rest, pedals })
    last.current = state
    sender.current.push(state)
  })
}
