import { DEMO_CARD, demoCardBody, unlockWord } from '../../shared/play-words.mjs'

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
export default function UnlockOffer({ price, onUnlock, onPutAway }) {
  return (
    <div className="demo-card" role="region" aria-label={DEMO_CARD}>
      <div className="demo-card-words">
        <p className="demo-card-head">{DEMO_CARD}</p>
        <p className="demo-card-body">{demoCardBody()}</p>
      </div>
      {/* The price, where there is one: asking somebody to tap to find out what it costs is asking for the tap most people will not make. */}
      <button type="button" className="demo-card-unlock" onClick={onUnlock} aria-label="Unlock the full version">
        {unlockWord(price)}
      </button>
      <button type="button" className="demo-card-close" onClick={onPutAway} aria-label="Put this away">
        ×
      </button>
    </div>
  )
}
