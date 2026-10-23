import { useState } from 'react'

/**
 * WHICH COMPUTER PLAY IS ON, WHEN THAT IS THE QUESTION: the phone's
 * components/ComputerCard, the same words (shared/relay-rules.mjs
 * unitElsewhere, missingPickCard). With two or more computers on the
 * account, the one driven can have no unit while the unit is on another, or
 * be driven in place of a pick that never answers. Each button is the way
 * out it names, Which unit's own proved pick or keeping the one driven, and
 * nothing moves until one is pressed.
 */
export default function ComputerCard({ title = null, words, buttons = [] }) {
  const [busy, setBusy] = useState(null)
  return (
    <div className="notice computer-card" data-kind="where" role="status">
      {title ? <h2>{title}</h2> : null}
      <p>{words}</p>
      <p className="host-pick">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            className="chip"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(b.label)
              try {
                await b.onClick?.()
              } finally {
                setBusy(null)
              }
            }}
          >
            {busy === b.label ? 'Switching…' : b.label}
          </button>
        ))}
      </p>
    </div>
  )
}

/**
 * The pick that does not answer, under Which unit: after the units that do,
 * grayed, with Forget, which leaves nothing picked (the phone's
 * components/MissingPick). Nothing to press on the name itself: there is
 * nobody there to drive.
 */
export function MissingRow({ row, onForget }) {
  return (
    <div className="setup-row setup-row-missing">
      <span className="setup-row-text">
        <span className="setup-row-title">{row.label}</span>
      </span>
      <button type="button" className="chip" onClick={onForget}>
        {row.forget}
      </button>
    </div>
  )
}
