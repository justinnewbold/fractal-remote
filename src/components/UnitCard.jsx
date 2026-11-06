import { useState } from 'react'

import { NOT_USING_ONE, SWITCHING, notUsingOneHow } from '../lib/remote'

/**
 * ONE COMPUTER UNDER WHICH UNIT, AS A CARD: the phone's (mobile/src/
 * components/UnitCard.js), from the same words (shared relay-rules
 * unitCards). The whole card is one button: a dot, the unit with the
 * computer it is on beside it, CONNECTED or ONLINE, and the preset and
 * scene the unit is on when they are known. `busy` is the card tapped while
 * it is switched to: Switching… in place of its tag.
 */
export default function UnitCard({ card, busy = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      className={`unit-card${card.on ? ' unit-card-on' : ''}${card.plugged ? ' unit-card-plugged' : ''}`}
      aria-pressed={card.on}
      aria-busy={busy || undefined}
      aria-label={busy ? `${card.said}, ${SWITCHING}` : card.said}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="unit-card-top">
        <span className="unit-card-dot" aria-hidden="true" />
        <span className="unit-card-name">
          <span className="unit-card-unit">{card.label}</span>
          {card.where ? <span className="unit-card-where"> {card.where}</span> : null}
        </span>
        {busy ? <span className="unit-card-busy">{SWITCHING}</span> : card.tag ? <span className="unit-card-tag">{card.tag}</span> : null}
      </span>
      {card.note ? <span className="unit-card-note">{card.note}</span> : null}
      {card.lines.map((line) => (
        <span key={line.label} className="unit-card-line">
          <span className="unit-card-label">{line.label}</span>
          <span className="unit-card-value">{line.value}</span>
        </span>
      ))}
    </button>
  )
}

/** How a computer you don't use comes off the list (notUsingOne): the question as a link, and the rest when it is pressed. */
export function NotUsingOne() {
  const [shown, setShown] = useState(false)
  return (
    <div className="unit-card-how">
      <button type="button" className="unit-card-how-link" aria-expanded={shown} onClick={() => setShown((was) => !was)}>
        {NOT_USING_ONE}
      </button>
      {shown ? <p className="hint">{notUsingOneHow('page')}</p> : null}
    </div>
  )
}
