import { useState } from 'react'

import SetupRow from './SetupRow'
import { isDemo } from '../lib/forgefx'
import { setMetronome, useMetronome, useUnitHeardOn } from '../lib/metronome'
import { PLACES, placeLit, unitClick } from '../../shared/metronome.mjs'

/**
 * The metronome, on and off, in the Volume sheet — the phone's
 * MetronomeSwitch.
 *
 * "Make it so the metronome can be turned on and off in the volume section of
 * the app." Only on and off: where it clicks is chosen on Setup's Metronome
 * page, and this says which in the same words. The press is also the one that
 * lets this screen's beep start, which a browser allows only on a press.
 */
export default function MetronomeSwitch({ slug }) {
  const setting = useMetronome()
  const heard = useUnitHeardOn(slug)
  const unitCan = unitClick(slug, { demo: isDemo() })
  const [said, setSaid] = useState(null)

  const place = PLACES.find((p) => placeLit(setting, p.key, true))?.key
  const where = !unitCan.can
    ? unitCan.why.replace(/(only )?the phone keeps time/, (_m, only) => `${only || ''}this screen keeps time`)
    : place === 'phone'
      ? 'Beeps and flashes here'
      : place === 'both'
        ? 'The unit clicks and this screen keeps time with it'
        : PLACES[0].note
  const untilHeard = unitCan.can && setting.on && setting.where === 'unit' && !heard ? 'Until the unit says its click is on, this screen keeps time as well.' : ''
  /* Each part a sentence: the place notes are written as labels, with no full stop. */
  const line = [where, untilHeard]
    .filter(Boolean)
    .map((t) => (/[.!?]$/.test(t) ? t : `${t}.`))
    .join(' ')

  return (
    <>
      <p className="silk-label setup-group">Metronome</p>
      <div className="setup-rows">
        <SetupRow
          title={setting.on ? 'Metronome on ✓' : 'Metronome off'}
          status={setting.on ? 'Tap to turn it off' : 'Tap to turn it on'}
          onClick={async () => {
            setSaid(null)
            const answer = await setMetronome({ on: !setting.on }, slug)
            if (answer?.ok === false && !answer?.unsupported) setSaid('The unit didn’t take it. Check it’s connected, then try again.')
          }}
        />
      </div>
      <p className="footnote">{line}</p>
      {said ? (
        <p className="save-error" role="status">
          {said}
        </p>
      ) : null}
    </>
  )
}
