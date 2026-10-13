import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { requireOptionalNativeModule } from 'expo'

import { blockColor } from './blockColors'
import { logDebug } from './debugLog'
import { idOf } from './device'
import { probeNow, untilConnected } from './link'
import { shortBlock } from './shortName'
import { getState, writeBypass, writeScene, writeTuner } from './rig'
import { createWatchSender, watchCommand, watchState } from './watch-link'
import { metronome } from './metronome'

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

/*
 * HOW THE WATCH IS USED, in the order somebody meets it. One list for both
 * places that say it: the note the Play screen shows once, and Settings →
 * Apple Watch, where it can be read again.
 */
export const WATCH_HOW_OPEN = 'Keep the Play screen open on your iPhone while you use the watch. The watch works through this app, so it stops when the app is closed or the phone locks.'
export const WATCH_HOW_LOCKED = 'Leave this app on the Play screen, then lock your iPhone and put it away. Each tap on the watch wakes the phone for a moment to send it. The live tuner needs the phone open.'
export const WATCH_HOW = [
  WATCH_HOW_OPEN,
  'Swipe up or down on the watch, or turn the Digital Crown, to move between its four pages: Scenes, Pedals, Presets and Tuner.',
  'Tap a scene or a pedal to switch it. Presets has Previous and Next.',
  'The tuner starts only when you tap it, and turns off when you leave its page.'
]

/** Whether this build wakes on a watch tap, so the phone may stay locked. */
export function watchWakes() {
  try {
    return link()?.wakes?.() === true
  } catch {
    return false
  }
}

/** How the watch is used, in this build's words: the first line depends on wake on tap. */
export const watchHow = () => (watchWakes() ? [WATCH_HOW_LOCKED, ...WATCH_HOW.slice(1)] : WATCH_HOW)

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
      const asleep = AppState.currentState !== 'active'
      logDebug('watch', cmd.do, `${JSON.stringify(cmd)}${asleep ? ' (woke the phone)' : ''}`)
      if (cmd.do === 'hello') {
        sender.current?.flush(last.current)
        if (asleep) probeNow()
        return
      }
      const run = () => {
        if (cmd.do === 'scene') return writeScene(cmd.index)
        if (cmd.do === 'pedal') return writeBypass(cmd.id, !cmd.on)
        if (cmd.do === 'preset') return stepRef.current?.(cmd.step)
        if (cmd.do === 'tuner' && getState().tunerOn !== cmd.on) return writeTuner(cmd.on)
        return undefined
      }
      if (!asleep) {
        run()
        return
      }
      /*
       * WOKEN BY THE TAP, the phone locked in a pocket. The connection to the
       * computer slept with the app, so it is rejoined first, then the tap is
       * sent, and tried once more if the first go found it still waking.
       */
      const pause = (ms) => new Promise((r) => setTimeout(r, ms))
      /* The link can still say "connected" for a moment after waking, before
         it notices the connection slept; the short pause lets it find out. */
      probeNow()
      pause(400)
        .then(() => untilConnected())
        .then(() => Promise.resolve(run()))
        .catch(async (err) => {
          logDebug('watch', 'first try failed while waking', err?.message || String(err))
          await pause(1500)
          await untilConnected()
          return run()
        })
        .catch((err) => logDebug('watch', 'gave up', err?.message || String(err)))
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
    /* The metronome's tap, when the watch's switch is on: see lib/metronome. */
    const beat = metronome()
    const state = watchState({ ...rest, pedals, metronome: { on: beat.on && beat.watch, bpm: getState().bpm } })
    last.current = state
    sender.current.push(state)
  })
}
