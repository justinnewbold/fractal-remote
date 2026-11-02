import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { AXIOM_FAILED, AXIOM_ID, AXIOM_LABEL, axiomComputerCan, axiomData, axiomOnIn, axiomSub } from '../lib/axiom'
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
 * What it shows is read back from the computer, at first and again after a
 * change has gone through: the computer starts its link to the unit again to
 * honour it, so the link drops for a few seconds and comes back by itself.
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
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!usable) return undefined
    let stop = false
    readSwitch().then((value) => {
      if (!stop && value !== null) setOn(value)
    })
    return () => {
      stop = true
    }
  }, [usable, macName])

  if (!usable) return null

  const change = async () => {
    if (busy || on === null) return
    const next = !on
    setBusy(true)
    setFailed(false)
    try {
      await writeComputerSetting(AXIOM_ID, axiomData(next, Date.now()))
      setOn(next)
    } catch {
      /* Not known whether it landed: ask again rather than guess. */
      setFailed(true)
      const value = await readSwitch()
      if (value !== null) setOn(value)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: space.xs }}>
      {heading}
      <TickBox on={on === true} label={AXIOM_LABEL} sub={axiomSub(macName || 'the computer')} disabled={busy || on === null} onPress={change} />
      {failed ? (
        <Text style={{ color: color.fault, fontSize: font.small, paddingHorizontal: space.sm }}>{AXIOM_FAILED}</Text>
      ) : null}
    </View>
  )
}
