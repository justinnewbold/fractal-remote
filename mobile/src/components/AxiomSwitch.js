import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'

import {
  AXIOM_FAILED,
  AXIOM_ID,
  AXIOM_LABEL,
  AXIOM_RELOOKS,
  AXIOM_RELOOK_MS,
  AXIOM_SETTLE_MS,
  AXIOM_SETTLING,
  axiomComputerCan,
  axiomData,
  axiomOnIn,
  axiomSub
} from '../lib/axiom'
import { isOlder } from '../lib/versions'
import { readComputerSetting, writeComputerSetting } from '../lib/device'
import { color, font, space } from '../lib/theme'
import TickBox from './TickBox'

/**
 * "ALSO LET AXIOM USE THIS PEDAL", from the phone, for a Raspberry Pi with
 * no keyboard (shared/axiom.mjs says what it does). On Phone & computer, for
 * Justin's account only: Settings draws it behind isAdmin.
 *
 * Only for a computer that can honour it: connected through the computer
 * (not the demo, not Bluetooth) to a computer app from AXIOM_COMPUTER_FROM
 * on. Anything else draws nothing, so the tick never says Axiom is let in on
 * a computer that would not read it.
 *
 * What it shows is read from the computer it is about, and only an answer
 * counts. Moving to another computer (Which unit) starts again from nothing,
 * so one Pi's tick is never shown under another's name; a read the computer
 * could not answer is asked again, keeping what was shown. After a change the
 * computer starts its link to the unit again, so the link drops for a few
 * seconds and comes back by itself: the box is held still meanwhile
 * (AXIOM_SETTLE_MS), so a second tap cannot land in the gap, and the switch
 * is then read back.
 *
 * `heading` is drawn above it only when it is drawn at all, so a page never
 * shows a heading with nothing under it.
 */

/* The switch as the computer says it: true or false, or null when it could not be asked. */
const readSwitch = async () => {
  const data = await readComputerSetting(AXIOM_ID)
  return data === undefined ? null : axiomOnIn(data)
}

export default function AxiomSwitch({ link, demo = false, throughAdapter = false, hostVersion = null, macName = null, heading = null }) {
  const usable = link === 'connected' && !demo && !throughAdapter && axiomComputerCan(hostVersion, isOlder)
  /* null until the computer has said. */
  const [on, setOn] = useState(null)
  const [busy, setBusy] = useState(false)
  const [settling, setSettling] = useState(false)
  const [failed, setFailed] = useState(false)
  /* Bumped to read the switch again. */
  const [asks, setAsks] = useState(0)
  const settle = useRef(null)

  /* Another computer is another switch: nothing of the last one's is kept. */
  useEffect(() => {
    setOn(null)
    setFailed(false)
  }, [macName])

  useEffect(() => {
    if (!usable) return undefined
    let stop = false
    let again = null
    const look = async (left) => {
      const value = await readSwitch()
      if (stop) return
      if (value === null) {
        if (left > 0) again = setTimeout(() => look(left - 1), AXIOM_RELOOK_MS)
        return
      }
      setOn(value)
    }
    look(AXIOM_RELOOKS)
    return () => {
      stop = true
      clearTimeout(again)
    }
  }, [usable, macName, asks])

  useEffect(() => () => clearTimeout(settle.current), [])

  if (!usable) return null

  const change = async () => {
    if (busy || settling || on === null) return
    const next = !on
    setBusy(true)
    setFailed(false)
    try {
      await writeComputerSetting(AXIOM_ID, axiomData(next, Date.now()))
      setOn(next)
      setSettling(true)
      clearTimeout(settle.current)
      settle.current = setTimeout(() => {
        setSettling(false)
        setAsks((n) => n + 1)
      }, AXIOM_SETTLE_MS)
    } catch {
      /* Not known whether it landed: what is shown stays, and the computer is asked again. */
      setFailed(true)
      setAsks((n) => n + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: space.xs }}>
      {heading}
      <TickBox
        on={on === true}
        label={AXIOM_LABEL}
        sub={settling ? AXIOM_SETTLING : axiomSub(macName || 'the computer')}
        disabled={busy || settling || on === null}
        onPress={change}
      />
      {failed ? (
        <Text style={{ color: color.fault, fontSize: font.small, paddingHorizontal: space.sm }}>{AXIOM_FAILED}</Text>
      ) : null}
    </View>
  )
}
