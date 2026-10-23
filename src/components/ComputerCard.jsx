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
  return (
    <div className="notice computer-card" data-kind="where" role="status">
      {title ? <h2>{title}</h2> : null}
      <p>{words}</p>
      <CardButtons buttons={buttons} />
    </div>
  )
}

/**
 * The card's buttons, one per way out. The one pressed says Switching… and
 * all of them wait while its pick is proved, which can take seconds (three
 * for a slow pick, longer after a drop): with no sign of it, a press looked
 * like nothing and was pressed again. The fault notice that says the unit is
 * on another computer has the same buttons, from here.
 */
export function CardButtons({ buttons = [] }) {
  const [busy, setBusy] = useState(null)
  return (
    <p className="host-pick">
      {buttons.map((b, i) => (
        <button
          key={b.key || b.label}
          type="button"
          className="chip"
          disabled={busy !== null}
          onClick={async () => {
            setBusy(i)
            try {
              await b.onClick?.()
            } finally {
              setBusy(null)
            }
          }}
        >
          {busy === i ? 'Switching…' : b.label}
        </button>
      ))}
    </p>
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
