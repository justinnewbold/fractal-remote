import { DEMO_CARD, demoCardBody, unlockWord } from '../../shared/play-words.mjs'
import { DEMO_NUDGE_GO, demoTrialLine } from '../../shared/trial-words.mjs'

/**
 * THE DEMO'S CARD ON PLAY, the phone's (mobile/src/components/UnlockOffer.js):
 * "This is the demo", what unlocking gives, Unlock with the price, and a ×
 * that puts it away. App decides when it is up (offerShown): in the demo, not
 * paid, once the purchase has been checked, after the demo's own line, and
 * not after its × (fab.demo.offer).
 *
 * Not one word is typed here: they are shared/play-words.mjs's, which says
 * the phone's words, and the line under the heading is read when it is shown,
 * since the website changes role after it loads ("this browser", "this
 * phone", or on the computer app's own window "a phone or tablet").
 */
export default function UnlockOffer({ price, trial = false, onUnlock, onPutAway }) {
  return (
    <div className="demo-card" role="region" aria-label={DEMO_CARD}>
      <div className="demo-card-words">
        <p className="demo-card-head">{DEMO_CARD}</p>
        {/* The free trial first where this page offers it (App's trialHere), as the phone's card does (8 November 2026); its button opens the same unlock page, where the trial starts with its terms under it. */}
        <p className="demo-card-body">{trial ? demoTrialLine(price) : demoCardBody()}</p>
      </div>
      {/* The price, where there is one: asking somebody to tap to find out what it costs is asking for the tap most people will not make. */}
      <button type="button" className="demo-card-unlock" onClick={onUnlock} aria-label={trial ? 'Try the full version free' : 'Unlock the full version'}>
        {trial ? DEMO_NUDGE_GO : unlockWord(price)}
      </button>
      <button type="button" className="demo-card-close" onClick={onPutAway} aria-label="Put this away">
        ×
      </button>
    </div>
  )
}
