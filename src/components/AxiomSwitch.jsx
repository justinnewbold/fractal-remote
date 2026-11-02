import { useEffect, useState } from 'react'
import { AXIOM_FAILED, AXIOM_ID, AXIOM_LABEL, axiomData, axiomOnIn, axiomSub } from '../../shared/axiom.mjs'
import { inDesktopApp } from '../lib/desktop'
import { isDemo, readHostDoc, writeHostDoc } from '../lib/forgefx'

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
 * What it shows is read back from the computer's store. The computer app
 * starts the link to the unit again to honour a change, a few seconds later.
 */
export default function AxiomSwitch({ admin = false }) {
  const usable = inDesktopApp() && !isDemo()
  /* null until the store has said. */
  const [on, setOn] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!usable) return undefined
    let stop = false
    readHostDoc(AXIOM_ID).then((data) => {
      if (!stop) setOn(axiomOnIn(data))
    })
    return () => {
      stop = true
    }
  }, [usable])

  if (!usable || on === null || (!admin && !on)) return null

  const change = async (next) => {
    setBusy(true)
    setFailed(false)
    try {
      const wrote = await writeHostDoc(AXIOM_ID, axiomData(next, Date.now()))
      if (!wrote) setFailed(true)
      setOn(axiomOnIn(await readHostDoc(AXIOM_ID)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label className="rename-choice">
        <input type="checkbox" checked={on} disabled={busy} onChange={(e) => change(e.target.checked)} />
        <span>
          {AXIOM_LABEL}
          <span className="hint">{axiomSub('this computer')}</span>
        </span>
      </label>
      {failed ? <p className="hint">{AXIOM_FAILED}</p> : null}
    </div>
  )
}
