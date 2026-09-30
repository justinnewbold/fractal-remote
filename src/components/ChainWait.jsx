import { useEffect, useState } from 'react'
import { useDevice, chainKnownOf, chainNumberOf, chainViewOf, retryChain } from '../lib/deviceState'
import { CHAIN_WORDS, UPDATING_AFTER_MS, chainElsewhere } from '../../shared/chain-view.mjs'

/**
 * Whose chain is on screen, for a panel that draws it.
 *
 * `view` is shared/chain-view.mjs's answer. `late` is an Add, a Remove, a
 * Save or a Revert whose re-read has been going long enough to mention —
 * before that the chain simply stays as it is, because one that greyed and
 * came back on every Add would flicker. `elsewhere` is a chain that belongs
 * to another preset and is not drawn.
 *
 * `known` is this preset's chain up from memory, the read after the switch
 * still to come. Play plays it; a panel that EDITS the chain passes `editing`
 * and waits for the read instead — its values are read off the unit's
 * buffer, and that buffer is still loading.
 */
export function useChain({ editing = false } = {}) {
  const view = useDevice(chainViewOf)
  const number = useDevice(chainNumberOf)
  const known = useDevice(chainKnownOf)
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (view !== 'updating') {
      setLate(false)
      return undefined
    }
    const timer = setTimeout(() => setLate(true), UPDATING_AFTER_MS)
    return () => clearTimeout(timer)
  }, [view])
  return { view, number, known, late: view === 'updating' && late, elsewhere: chainElsewhere(view) || (editing && known) }
}

/**
 * Where a chain goes while it is another preset's.
 *
 * Grey cards rather than the old tiles greyed out: those belong to the last
 * song, and the tester's word for it was that a new preset REPLACES the old
 * chain. The cards hold the space, so the screen does not jump when the
 * blocks arrive. Try again when nothing is coming.
 *
 * `quiet` is for a panel under one that already says so: only the cards, so
 * the Edit screen does not say "Loading…" twice with two Try agains.
 */
export default function ChainWait({ chain, cards = 4, className = '', onRetry = retryChain, quiet = false }) {
  const failed = chain.view === 'failed'
  return (
    <div className={`chain-wait ${className}`} {...(quiet ? { 'aria-hidden': true } : { role: 'status', 'aria-live': 'polite' })}>
      <div className="chain-wait-cards" aria-hidden="true">
        {Array.from({ length: cards }, (_, i) => (
          <span key={i} className="chain-wait-card" />
        ))}
      </div>
      {quiet ? null : (
        <p className="hint chain-wait-words">
          <span>{failed ? CHAIN_WORDS.failed : CHAIN_WORDS.loading(chain.number)}</span>
          {failed ? (
            <button className="chip" onClick={() => onRetry()}>
              {CHAIN_WORDS.retry}
            </button>
          ) : null}
        </p>
      )}
    </div>
  )
}

/** The word a slow re-read of this preset's own chain shows beside it. */
export function ChainUpdating({ chain }) {
  if (!chain.late) return null
  return (
    <p className="hint chain-updating-word" role="status">
      {CHAIN_WORDS.updating}
    </p>
  )
}
