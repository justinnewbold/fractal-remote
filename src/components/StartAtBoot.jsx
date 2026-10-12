import { useEffect, useState } from 'react'
import { setStartAtBoot, startAtBootState } from '../lib/desktop'

/**
 * "Start when this computer turns on" — for the computer that lives on a
 * pedalboard or in a rack.
 *
 * "Make the computer app start by itself when the Pi turns on, and run with no
 * window." A Raspberry Pi on a pedalboard has no screen, so a person sets this
 * once, with a screen plugged in, and from then on the app is simply there
 * whenever the Pi is: no window, serving the phone, in the tray if anybody
 * looks.
 *
 * Draws nothing unless the computer says it can do this, which today is only
 * the Linux app. The Mac and Windows apps say no, and so does every phone and
 * browser, which have no computer app to ask. The switch is the computer's
 * own setting, not this page's: what it shows is read back from the computer
 * after every change, so it cannot claim to be on when the computer could not
 * make it so.
 */
export default function StartAtBoot() {
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let stop = false
    startAtBootState().then((s) => !stop && setState(s))
    return () => {
      stop = true
    }
  }, [])

  if (!state?.supported) return null

  const change = async (on) => {
    setBusy(true)
    try {
      const next = await setStartAtBoot(on)
      // An answer with no state in it means the question itself failed: ask afresh.
      setState(next && 'on' in next ? next : { ...((await startAtBootState()) || state), error: next?.error })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label className="rename-choice">
        <input type="checkbox" checked={Boolean(state.on)} disabled={busy} onChange={(e) => change(e.target.checked)} />
        <span>
          Start when this computer turns on
          <span className="hint">
            For a computer that lives on your pedalboard or in a rack: Fractal Remote starts by itself when the
            computer turns on, with no window. To see it, click its icon at the top of the screen, or open the
            app again.
          </span>
        </span>
      </label>
      {/* Plain words only. What the computer actually said ("EACCES: permission
          denied, open …") is in the app's log for whoever looks; on the page it
          is a line nobody at a pedalboard can act on. */}
      {state.error ? (
        <p className="hint">That didn&rsquo;t work on this computer. Try again, or restart the computer and try again.</p>
      ) : null}
    </div>
  )
}
