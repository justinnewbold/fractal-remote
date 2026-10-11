import { useState } from 'react'
import { View } from 'react-native'

import { space } from '../lib/theme'
import { ONLY_HERE, usePurchase } from '../lib/purchases'
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
 * NEVER IN THE WAY. A line and one button, put away with the cross for the
 * rest of this run; it comes back next time only while it is still true.
 * Nothing waits on it and nothing is locked behind it.
 */
export default function OnlyOnThisPhone({ onAccount }) {
  const { onlyHere } = usePurchase()
  const [gone, setGone] = useState(false)
  if (gone || !onAccount || !onlyHere) return null
  return (
    <View style={{ gap: space.sm }}>
      <Note onDismiss={() => setGone(true)}>{ONLY_HERE}</Note>
      <Press label="Make an account or sign in" onPress={onAccount} />
    </View>
  )
}
