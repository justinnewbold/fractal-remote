/*
 * EXPERIMENT ONLY (.github/workflows/turn-check.yml). Never merged, never
 * shipped. mobile/turn-check/tweak.mjs copies this file over
 * mobile/src/components/PhoneTurns.js in a CI runner's throwaway checkout,
 * after docs/pending has been applied, with __VARIANT__ replaced.
 *
 * It asks the phone exactly the way the real app does at launch (through the
 * real lib/turnScreen askTurn: UPRIGHT first, then TURNS about a second
 * later), but for every account and on every screen, so the first screen
 * (which needs no sign-in) may turn. Every ask, every size change and a beat
 * every two seconds are written with console.log as one line starting
 * "TURNEXP " and a JSON object, which React Native sends to the system log
 * (subsystem com.facebook.react.log, category javascript), and a red/green
 * band on screen says the same, so a screenshot proves which JavaScript ran.
 *
 * Variants:
 *   default         UPRIGHT, then TURNS 1 s later (the app's own sequence)
 *   never-upright   TURNS only, 1 s after start, never PORTRAIT_UP
 *   no-initial      as default; the native side has no
 *                   EXDefaultScreenOrientationMask (tweak.mjs drops the
 *                   plugin's initialOrientation before prebuild)
 *   force-landscape as default, then lockAsync(LANDSCAPE_RIGHT) at 15 s,
 *                   which needs no device rotation at all
 */
import { useEffect, useRef, useState } from 'react'
import { Dimensions, Text, View, useWindowDimensions } from 'react-native'
import { requireOptionalNativeModule } from 'expo'
import { OrientationLock } from 'expo-screen-orientation/build/ScreenOrientation.types'

import { TURNS, UPRIGHT } from '../lib/phoneTurns'
import { askTurn } from '../lib/turnScreen'

const VARIANT = '__VARIANT__'
const T0 = Date.now()
const FORCE_AT_MS = 15000

let native
function orientationModule() {
  if (native !== undefined) return native
  try {
    native = requireOptionalNativeModule('ExpoScreenOrientation') || null
  } catch {
    native = null
  }
  return native
}

/* What the native module says now: the lock is the KEY window's root view controller's supportedInterfaceOrientations (9 = unknown means no root view controller was found, 0 = all but upside down, 3 = portrait up). */
async function readNative() {
  const m = orientationModule()
  if (!m) return { module: false }
  const out = { module: true }
  for (const [key, fn] of [
    ['lock', 'getOrientationLockAsync'],
    ['platformLock', 'getPlatformOrientationLockAsync'],
    ['orientation', 'getOrientationAsync'],
  ]) {
    try {
      out[key] = typeof m[fn] === 'function' ? await m[fn]() : 'missing'
    } catch (e) {
      out[key] = `error: ${String(e?.message || e)}`
    }
  }
  return out
}

function sizeOf(d) {
  return `${Math.round(Number(d?.width) || 0)}x${Math.round(Number(d?.height) || 0)}`
}

function say(event, extra = {}) {
  const w = Dimensions.get('window') || {}
  const s = Dimensions.get('screen') || {}
  const line = { variant: VARIANT, t: Date.now() - T0, event, win: sizeOf(w), landscape: Number(w.width) > Number(w.height), screen: sizeOf(s), ...extra }
  try {
    console.log(`TURNEXP ${JSON.stringify(line)}`)
  } catch {}
  return line
}

export function PhoneTurns(props) {
  const win = useWindowDimensions()
  const [note, setNote] = useState({ asked: 'nothing yet', lock: '?', orientation: '?' })
  const live = useRef(true)

  /* What the real app would have handed this component (it is ignored here), so the log says where in the app the screenshot was taken. */
  const { allowed = false, inApp = false, onPlay = false, beside = false, stageView = false } = props || {}
  useEffect(() => {
    say('props', { allowed, inApp, onPlay, beside, stageView })
  }, [allowed, inApp, onPlay, beside, stageView])

  useEffect(() => {
    live.current = true
    const timers = []
    const after = (ms, fn) => timers.push(setTimeout(fn, ms))
    const report = async (event, extra = {}) => {
      const n = await readNative()
      say(event, { ...extra, ...n })
      if (live.current) setNote((was) => ({ ...was, ...(extra.step ? { asked: extra.step } : {}), lock: String(n.lock), orientation: String(n.orientation) }))
    }
    const ask = async (step) => {
      say('asking', { step })
      let took = false
      try {
        took = await askTurn(step)
      } catch (e) {
        say('ask threw', { step, error: String(e?.message || e) })
      }
      await report('asked', { step, took })
    }

    say('start', { module: !!orientationModule() })
    const m = orientationModule()
    let sub = null
    try {
      sub = m?.addListener?.('expoDidUpdateDimensions', (e) => say('native event', { e }))
    } catch (e) {
      say('no native event', { error: String(e?.message || e) })
    }

    if (VARIANT === 'never-upright') {
      after(1000, () => ask(TURNS))
    } else {
      ask(UPRIGHT)
      after(1000, () => ask(TURNS))
    }
    if (VARIANT === 'force-landscape') {
      after(FORCE_AT_MS, async () => {
        say('forcing', { lock: 'LANDSCAPE_RIGHT' })
        try {
          await m.lockAsync(OrientationLock.LANDSCAPE_RIGHT)
          await report('forced', { step: 'LANDSCAPE_RIGHT', took: true })
        } catch (e) {
          await report('forced', { step: 'LANDSCAPE_RIGHT', took: false, error: String(e?.message || e) })
        }
      })
    }
    const beat = setInterval(() => report('beat'), 2000)
    const dims = Dimensions.addEventListener('change', (now) => say('dims', { nowWin: sizeOf(now?.window), nowScreen: sizeOf(now?.screen) }))
    return () => {
      live.current = false
      timers.forEach(clearTimeout)
      clearInterval(beat)
      dims?.remove?.()
      sub?.remove?.()
    }
  }, [])

  const wide = win.width > win.height
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 44, left: 8, right: 8, zIndex: 99999, elevation: 99, backgroundColor: wide ? '#0a7a2a' : '#a01818', padding: 8, borderRadius: 6 }}
    >
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
        {`TURNEXP ${VARIANT} | window ${Math.round(win.width)}x${Math.round(win.height)} | ${wide ? 'LANDSCAPE' : 'PORTRAIT'}`}
      </Text>
      <Text style={{ color: '#fff', fontSize: 14 }}>{`asked ${note.asked} | lock ${note.lock} | orientation ${note.orientation}`}</Text>
    </View>
  )
}
