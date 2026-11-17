/*
 * THE PHONE HELD UPRIGHT, OR LET TURN, AS THE SCREEN CHANGES.
 *
 * Draws nothing. It reads what lib/phoneTurns needs from the device (the
 * whole screen's size, and what the phone keeps clear at its edges), asks
 * that rule what this screen wants, and tells the phone whenever the answer
 * changes (lib/turnScreen). App.js mounts it once, over every screen, so the
 * startup card and the sign-in are held upright by the same rule as
 * Settings.
 *
 * ON A TABLET IT ASKS THE PHONE'S MODULE FOR NOTHING: an iPad, an Android
 * tablet and a fold opened are exactly as they were. The one thing ever said
 * there is to let go of what was asked while the screen was a phone's (a
 * fold opened with the app up).
 *
 * WHETHER THE PHONE IS LONG ENOUGH TO SPLIT is worked out while it is
 * upright, when its insets are the ones the sum is written for, and kept
 * while it is on its side (a phone that starts on its side is taken at what
 * it has across then). A phone that turned and measured too narrow all
 * the same (App's own frame, `frame`) is upright from then on: once, and it
 * does not turn back and forth.
 *
 * ANDROID IS ASKED AGAIN EACH TIME THE APP COMES BACK TO THE FRONT. A new
 * MainActivity (Android makes one for some setting changes) starts with
 * nothing asked, and plugins/withTabletTurns starts it upright; the app's
 * own screen may still be Play. The iPhone's module does this for itself.
 *
 * AND THE LOG SAYS WHAT A PHONE DID (lib/turnScreen `sayTurn`, which adds
 * what the phone holds; since 17 November 2026, when a phone that had been
 * asked to turn did not, and the log could not say why). Three moments, on
 * a phone only, and nothing is asked of the phone at any of them: the app
 * goes onto its side or back upright; a phone on its side measures too
 * narrow, which keeps it upright for the rest of the run; and the iPhone
 * comes back to the front (Android is asked again there, which says it).
 */
import { useEffect, useRef, useState } from 'react'
import { AppState, Dimensions, Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RELEASE, TURNS, UPRIGHT, fitsSideways, isTablet, sidewaysAcross, tooNarrow, turnStep, turnsWanted } from '../lib/phoneTurns'
import { askTurn, sayTurn } from '../lib/turnScreen'

/* The app has the phone's whole length when its window is within this many points of the screen's: not a small window beside another app, whose width says nothing about the phone. */
const WHOLE_WITHIN = 100

const wholeScreen = () => {
  try {
    return Dimensions.get('screen') || {}
  } catch {
    return {}
  }
}

export function PhoneTurns({ allowed = false, inApp = false, onPlay = false, beside = false, stageView = false, frame = null }) {
  const insets = useSafeAreaInsets()
  const win = useWindowDimensions()
  const [screen, setScreen] = useState(wholeScreen)
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', (now) => setScreen(now?.screen || wholeScreen()))
    return () => sub?.remove?.()
  }, [])
  const width = Number(screen.width) || 0
  const height = Number(screen.height) || 0
  const long = Math.max(width, height)
  const tablet = isTablet({ pad: Platform.OS === 'ios' && Platform.isPad === true, width, height })

  /* What this screen would have across on its side, and whether it has measured too narrow: per screen size, so a fold's two screens each have their own. */
  const size = `${Math.min(width, height)}x${long}`
  const known = useRef({ size: null, across: 0, upright: false, narrow: false })
  if (known.current.size !== size) known.current = { size, across: 0, upright: false, narrow: false }
  if (height > width) {
    known.current.across = sidewaysAcross({ os: Platform.OS, width, height, top: insets.top, bottom: insets.bottom })
    known.current.upright = true
  } else if (!known.current.upright && width > height) {
    /* Started on its side (the app restarted for an update with Play turned): what it has across is what it has now, until an upright look says better. */
    known.current.across = Math.max(0, long - insets.left - insets.right)
  }
  if (allowed && !tablet && win.width >= long - WHOLE_WITHIN && tooNarrow({ frame, short: Math.min(width, height) })) known.current.narrow = true
  const narrow = known.current.narrow
  const fits = fitsSideways(known.current.across) && !narrow

  const wanted = turnsWanted({ tablet, allowed, fits, inApp, onPlay, beside, stageView })
  const wants = useRef(wanted)
  wants.current = wanted
  /* What the phone was last asked for: UPRIGHT, TURNS, or null for nothing. */
  const asked = useRef(null)
  useEffect(() => {
    const step = turnStep(asked.current, wanted)
    if (!step) return
    asked.current = step === RELEASE ? null : step
    askTurn(step).then((took) => {
      /* Not taken: nothing is in force, so the next change, or the next return to the front, asks afresh. */
      if (!took && asked.current === step) asked.current = null
    })
  }, [wanted])
  /* For the log alone (the note at the top): which way up the app is drawn, said when it changes; a phone found too narrow on its side; the iPhone back at the front. */
  const sideways = win.width > win.height
  const drawn = useRef(null)
  useEffect(() => {
    const was = drawn.current
    drawn.current = sideways
    if (tablet || was === null || was === sideways) return
    sayTurn(`the app is ${sideways ? 'on its side' : 'upright'} now, ${Math.round(win.width)}×${Math.round(win.height)}`)
  }, [sideways, tablet])
  useEffect(() => {
    if (narrow) sayTurn(`on its side the app measured ${Math.round(Number(frame?.width) || 0)} across, too narrow to split, so it stays upright from now on`)
  }, [narrow])
  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && (wants.current === UPRIGHT || wants.current === TURNS)) sayTurn(`back at the front, wanting "${wants.current}"`)
    })
    return () => sub?.remove?.()
  }, [])
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined
    const sub = AppState.addEventListener('change', (state) => {
      const now = wants.current
      if (state !== 'active' || (now !== UPRIGHT && now !== TURNS)) return
      asked.current = now
      askTurn(now).then((took) => {
        if (!took && asked.current === now) asked.current = null
      })
    })
    return () => sub?.remove?.()
  }, [])
  return null
}
