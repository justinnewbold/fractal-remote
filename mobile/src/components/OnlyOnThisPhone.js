import { useState } from 'react'
import { View } from 'react-native'

import { space } from '../lib/theme'
import { NOT_ACROSS, NOT_ACROSS_SIGNED_OUT, ONLY_HERE, restorePurchase, usePurchase } from '../lib/purchases'
import Note from './Note'
import Press from './Press'

/**
 * A purchase on this phone and on no account yet, said on the screen
 * somebody is looking at.
 *
 * Somebody who bought before making an account, and has not signed in
 * since, lands in two places: the sign-in screen, which says it there, and
 * the demo, which is this. Until they sign in, the website and the computer
 * app see an account that has not paid and offer to sell it again — which
 * is how one customer paid twice.
 *
 * AND ONE SENT TO THE ACCOUNT THAT HAS NOT ARRIVED (purchases.js, stuck).
 * The phone keeps itself unlocked for them, so no price page ever comes up
 * to say why the computer still sees nothing; this does, with the way to
 * try again now. Its own answer replaces the line when it is not a yes.
 *
 * Except with nobody signed in (NOT_ACROSS_SIGNED_OUT): there is no account
 * it has not reached, and Restore after a sign-out would put it on the
 * phone's nameless id rather than on anybody's account. Signing in, or
 * making the account, sends it, so that is the button.
 *
 * NEVER IN THE WAY. A line and one button, put away with the cross for the
 * rest of this run; it comes back next time only while it is still true.
 * Nothing waits on it and nothing is locked behind it.
 */
export default function OnlyOnThisPhone({ onAccount }) {
  const { onlyHere, stuck, held } = usePurchase()
  const [gone, setGone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState(null)
  if (gone) return null
  if (stuck && held === NOT_ACROSS_SIGNED_OUT) {
    return (
      <View style={{ gap: space.sm }}>
        <Note tone="warn" onDismiss={() => setGone(true)}>{NOT_ACROSS_SIGNED_OUT}</Note>
        {onAccount ? <Press label="Make an account or sign in" onPress={onAccount} /> : null}
      </View>
    )
  }
  if (stuck) {
    return (
      <View style={{ gap: space.sm }}>
        <Note tone="warn" onDismiss={() => setGone(true)}>{said || NOT_ACROSS}</Note>
        <Press
          label={busy ? 'Trying…' : 'Restore a purchase'}
          disabled={busy}
          onPress={async () => {
            setBusy(true)
            const out = await restorePurchase()
            setBusy(false)
            setSaid(out.ok ? null : out.message)
          }}
        />
      </View>
    )
  }
  if (!onAccount || !onlyHere) return null
  return (
    <View style={{ gap: space.sm }}>
      <Note onDismiss={() => setGone(true)}>{ONLY_HERE}</Note>
      <Press label="Make an account or sign in" onPress={onAccount} />
    </View>
  )
}
