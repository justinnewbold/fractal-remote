import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { currentAccount } from '../lib/relay'
import { isPairAccount } from '../lib/pairing'
import { useComputerElsewhere } from '../lib/useComputerElsewhere'
import { space } from '../lib/theme'
import Note from './Note'
import Press from './Press'
import { deviceNoun } from '../lib/device-word'

/**
 * The computer on this wifi is on another account, said on the stage screen.
 *
 * "When the app is signed in on the wrong account it should say so on the
 * main screen, not just in settings."
 *
 * Waking already said it — but only for the first stretch after launch. Once
 * the app had a rig to draw it moved on to the stage, and from there the one
 * place that knew was Setup: a grid of numbered scenes, an Untitled preset,
 * DISCONNECTED in the corner and nothing saying why. The same question and the
 * same sentence as Waking, asked while the link is down.
 */
export default function WrongAccount({ active, onSwitch, onTroubleshoot, onSaying }) {
  const elsewhere = useComputerElsewhere(active)
  /*
   * And App is told whether this is up, so the advice that floats over the
   * play screen once the computer has been gone fifteen seconds ("make sure
   * the computer is awake") does not contradict it. Waking puts the account
   * first in the same way.
   */
  const saying = Boolean(active && elsewhere)
  useEffect(() => {
    onSaying?.(saying)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saying])
  const [email, setEmail] = useState(null)
  useEffect(() => {
    if (!elsewhere) return undefined
    let live = true
    currentAccount().then((a) => live && setEmail(a?.email && !isPairAccount(a.email) ? a.email : null))
    return () => {
      live = false
    }
  }, [elsewhere])
  if (!active || !elsewhere) return null
  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm }}>
      <Note tone="fault">
        {email
          ? `The computer on this wifi is signed into a different account. This ${deviceNoun()} is signed in as ${email}. On the computer, sign in to the Fractal Remote app with ${email}, or sign this ${deviceNoun()} into the computer’s account.`
          : `The computer on this wifi is signed into a different account than this ${deviceNoun()}. Sign both into the same account.`}
      </Note>
      {onSwitch ? <Press label={`Switch account on this ${deviceNoun()}`} onPress={onSwitch} /> : null}
      {onTroubleshoot ? <Press label="Troubleshooting" onPress={onTroubleshoot} /> : null}
    </View>
  )
}
