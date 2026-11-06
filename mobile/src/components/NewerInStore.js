import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { markCardSeen, openStore, useStoreNote } from '../lib/storeVersion'
import { useUpdates } from '../lib/updates'
import { space } from '../lib/theme'
import Note from './Note'
import Press from './Press'
import WhatsNewLink from './WhatsNewLink'

/**
 * A NEWER VERSION IS IN THE STORE, said once, at the top of Settings.
 *
 * The copy on this phone is older than the store's, and the app has always
 * kept quiet about it: once a new store version changes what an update needs
 * to find inside the app, the older copies simply stop getting updates (see
 * lib/store-rule.js). The quiet line under About → Updates says it for as
 * long as it is true; this card says it out loud, ONCE for each store
 * version, and the ✕ or leaving Settings puts it away for good.
 *
 * Here and nowhere else: never on the Play screen and never over it, where a
 * card about the store is the last thing anybody needs mid-song. Settings is
 * where somebody goes when they have a moment.
 *
 * Shown in the demo as well, before anybody has signed in. It is about the
 * copy on the phone, not the account — and somebody who has just installed
 * the app has the newest copy and never sees it, so in practice it reaches
 * only the old copies it is for.
 *
 * With What's new beside the store button (Justin, 6 November 2026: "a link
 * that takes them straight to the part of the app that shows them what's
 * new"). `onWhatsNew` is Settings' own page change, so the card goes the way
 * leaving the front of Settings always puts it away, and Back from the list
 * comes up to Settings. An old copy stops getting updates, so the page reads
 * the website's list as well, for what the newer version has
 * (screens/WhatsNew.js).
 */
export default function NewerInStore({ onWhatsNew = null }) {
  const { note, card } = useStoreNote()
  /*
   * Not while the new-version note is up, just above it. Two cards in nearly
   * the same words read as one, and Restart now looks as if it answers both;
   * the store card, said once, would be spent at its most confusing moment.
   * It waits for the first visit after the restart (or after that note is put
   * away). The quiet line under About → Updates says it meanwhile.
   */
  const updates = useUpdates()
  const readyAbove = updates.phase === 'ready' && !updates.dismissed
  /* The store version this visit is showing the card for. Seen the moment it is shown, so the next visit does not show it again. */
  const [showing, setShowing] = useState(null)
  useEffect(() => {
    if (!card || !note || readyAbove) return
    setShowing(note.newest)
    markCardSeen(note.newest)
  }, [card, note, readyAbove])
  if (!note || showing !== note.newest) return null
  return (
    <View style={{ gap: space.sm }}>
      <Note tone="warn" onDismiss={() => setShowing(null)}>
        {`${note.title}. ${note.why}`}
      </Note>
      <Press label={note.button} onPress={() => openStore(note)} />
      {/* Under the store button rather than beside it: "Open the App Store" in Larger Text takes a 320-wide row to itself. */}
      {onWhatsNew ? <WhatsNewLink onPress={onWhatsNew} /> : null}
    </View>
  )
}
