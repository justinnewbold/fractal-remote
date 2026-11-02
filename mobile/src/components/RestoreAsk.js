import { View } from 'react-native'

import { space } from '../lib/theme'
import { RESTORE_HERE, RESTORE_HERE_COSTS, RESTORE_WHOSE, SIGN_IN_TO_IT } from '../lib/purchases'
import Note from './Note'
import Press from './Press'

/**
 * Restore a purchase, tapped with nobody signed in: what it would do, and
 * the two ways on (the 2 November 2026 audit).
 *
 * A Restore from here moved a buyer's purchase off their account onto this
 * phone's nameless id, and their computer was refused (purchases.js,
 * RESTORE_WHOSE). So the purchase's own account comes first, and signing
 * in to it moves nothing off anybody. Restoring here is the second button,
 * with what it costs under it, and it is the only thing that sends the
 * Restore on (`onHere`, which calls restorePurchase with `here`).
 *
 * Shown by the paywall and the walkthrough, under their Restore. No words
 * typed here: they are purchases.js's, so the two screens say the same.
 */
export default function RestoreAsk({ onSignIn, onHere, busy = false }) {
  return (
    <View style={{ gap: space.sm }}>
      <Note tone="warn">{RESTORE_WHOSE}</Note>
      {onSignIn ? <Press label={SIGN_IN_TO_IT} tone="signal" disabled={busy} onPress={onSignIn} /> : null}
      <Press label={RESTORE_HERE} sub={RESTORE_HERE_COSTS} disabled={busy} onPress={onHere} />
    </View>
  )
}
