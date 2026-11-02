import { useEffect, useRef, useState } from 'react'
import {
  AXIOM_FAILED,
  AXIOM_ID,
  AXIOM_LABEL,
  AXIOM_RELOOKS,
  AXIOM_RELOOK_MS,
  AXIOM_SETTLE_MS,
  AXIOM_SETTLING,
  axiomData,
  axiomOnIn,
  axiomSub
} from '../../shared/axiom.mjs'
import { inDesktopApp } from '../lib/desktop'
import { hostDocOrUnknown, isDemo, writeHostDoc } from '../lib/forgefx'

/**
 * "Also let Axiom use this pedal", in the computer's own window: for a
 * Raspberry Pi reached through Raspberry Pi Connect, one click and no typing.
 * shared/axiom.mjs says what it does.
 *
 * Only in the computer app's window, where the device server is this
 * computer's own and the window's page is this computer's app, so the
 * computer that is told is always one that reads it. Not in the demo, which
 * has no store. Drawn for Justin's account (`admin`, his sign-in on the
 * window or the computer's own), and, whoever is signed in, while it is on,
 * so a switch that is on is never out of sight on the computer it is on.
 *
 * What it shows is read back from the computer's store, and only an answer
 * counts: a change restarts the device server, so for a few seconds the
 * computer does not answer, and "no answer" is never shown as "off". After a
 * change the box is held still until the restart is over (AXIOM_SETTLE_MS),
 * so a second click cannot land in the gap, and then the switch is read again.
 */
export default function AxiomSwitch({ admin = false }) {
  const usable = inDesktopApp() && !isDemo()
  /* null until the store has said. */
  const [on, setOn] = useState(null)
  const [busy, setBusy] = useState(false)
  const [settling, setSettling] = useState(false)
  const [failed, setFailed] = useState(false)
  /* Bumped to read the switch again. */
  const [asks, setAsks] = useState(0)
  const settle = useRef(null)

  useEffect(() => {
    if (!usable) return undefined
    let stop = false
    let again = null
    const look = async (left) => {
      const data = await hostDocOrUnknown(AXIOM_ID)
      if (stop) return
      if (data === undefined) {
        /* The computer did not answer: most likely the restart for this very switch. Keep what is shown, and ask again. */
        if (left > 0) again = setTimeout(() => look(left - 1), AXIOM_RELOOK_MS)
        return
      }
      setOn(axiomOnIn(data))
    }
    look(AXIOM_RELOOKS)
    return () => {
      stop = true
      clearTimeout(again)
    }
  }, [usable, asks])

  useEffect(() => () => clearTimeout(settle.current), [])

  if (!usable || on === null || (!admin && !on)) return null

  const change = async (next) => {
    setBusy(true)
    setFailed(false)
    try {
      if (await writeHostDoc(AXIOM_ID, axiomData(next, Date.now()))) {
        setOn(next)
        setSettling(true)
        clearTimeout(settle.current)
        settle.current = setTimeout(() => {
          setSettling(false)
          setAsks((n) => n + 1)
        }, AXIOM_SETTLE_MS)
      } else {
        /* Not known whether it landed: what is shown stays, and the store is asked again. */
        setFailed(true)
        setAsks((n) => n + 1)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label className="rename-choice">
        <input type="checkbox" checked={on} disabled={busy || settling} onChange={(e) => change(e.target.checked)} />
        <span>
          {AXIOM_LABEL}
          <span className="hint">{settling ? AXIOM_SETTLING : axiomSub('this computer')}</span>
        </span>
      </label>
      {failed ? <p className="hint">{AXIOM_FAILED}</p> : null}
    </div>
  )
}
