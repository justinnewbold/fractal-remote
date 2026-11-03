import { coachWords } from '../../shared/play-words.mjs'

/**
 * THE TIP ABOUT HOLDING A PEDAL, drawn where the gesture is: the phone's
 * components/Coach.js, a card in the chain directly above the tiles it is
 * talking about. "This tip appears here - exactly when the gesture becomes
 * useful." Gig shows it only on a preset whose blocks really do have channels
 * to choose between, and keeps it there through preset changes until it is
 * put away. It does not dim the screen: the blocks are what the reader needs.
 *
 * Three stages, the phone's: the tip (two buttons), trying (after the first,
 * waiting for the hold, with only the second), and done (a channel sheet
 * opened, and one button that closes it).
 *
 * Not one word is typed here. Every string comes from the copy file through
 * shared/play-words.mjs coachWords (P5, his copy: "do not change any wording
 * without asking me first"), which on an AM4 says what the amp's tap does.
 */
export default function Coach({ stage = 'tip', slug, onTry, onSkip, onDone }) {
  const w = coachWords(stage, slug)
  return (
    <div className="coach" role="status" aria-live="polite">
      <p className="coach-count">{w.count}</p>
      <p className="coach-head">{w.head}</p>
      <p className="coach-body">{w.body}</p>
      {/* The gesture named on a swatch the colour of a block that is on, not a drawing of a block: the real ones are just below. */}
      <span className="coach-hold">{w.hold}</span>
      <div className="coach-buttons">
        {stage === 'tip' ? (
          <>
            <button type="button" className="coach-go" onClick={onTry}>
              {w.go}
            </button>
            <button type="button" onClick={onSkip}>
              {w.skip}
            </button>
          </>
        ) : stage === 'trying' ? (
          <button type="button" onClick={onSkip}>
            {w.skip}
          </button>
        ) : (
          <button type="button" className="coach-go" onClick={onDone}>
            {w.done}
          </button>
        )}
      </div>
      <p className="coach-foot">{w.foot}</p>
    </div>
  )
}
