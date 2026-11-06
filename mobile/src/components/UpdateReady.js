import { useEffect } from 'react'
import { View } from 'react-native'

import { applyNow, dismissReady, useUpdates } from '../lib/updates'
import { askWaiting } from '../lib/whatsNewWaiting'
import { space } from '../lib/theme'
import Note from './Note'
import Press from './Press'
import Toast from './Toast'
import WhatsNewLink from './WhatsNewLink'

/**
 * A NEW VERSION IS READY, said under the bar the way the browser says it.
 *
 * "Is it possible to do that once the phone actually downloads an update so
 * that they could just click that to restart it?"
 *
 * Only once the download has finished — a banner offering something that is
 * not on the phone yet would restart into the same version. The ✕ puts it
 * away until the next launch, and the Updates row in Settings still offers
 * the same restart. See watchForUpdates in lib/updates.js for when it asks,
 * and lib/update-rule.js for when the app takes it by itself instead.
 *
 * `over`: FLOATING OVER THE PLAY SCREEN, never pushing it down. In the
 * column under the bar it was one more row above the preset, so everything
 * under a thumb slid down the moment a download landed — the same complaint
 * that floated the play screen's faults ("Can we just have it be like an
 * overlay toast notification that doesn't move the screen at all?"). So on
 * the play screen it is a Toast in the same place as the fault, no bigger
 * than the fault with its fix button, and it stands aside while the fault or
 * the advice card is up. On every other screen it stays in the column, where
 * a floating card would sit on the Back and Done buttons at the top.
 *
 * AND SHORT ENOUGH TO STAY OFF THE SCENES. The column's sentence ran to three
 * lines on a 320-wide phone with a wide font (an Android font, or Larger
 * Text), which put Restart now over the top of scenes 1 and 2 — further down
 * than the fault reaches, and a tap meant for a scene would have restarted
 * the app. Two lines fit in any font at that width, so the floating one says
 * only what it must; the column, with room to spare, keeps the longer one.
 *
 * WITH WHAT'S NEW BESIDE RESTART NOW. "On the card that says a new version
 * of the app is available. Can you have a link that says what's new?"
 * (Justin, 6 November 2026.) `onWhatsNew` opens Settings → About → What's
 * new (App.js openWhatsNew). In the button row, beside Restart now, so the
 * floating card is no taller than it was and the sentence keeps its two
 * lines. The list on the phone does not have the waiting update's lines yet
 * (they arrive with it), so the moment the card is shown the website's copy
 * is asked for them (lib/whatsNewWaiting.js), and the page puts them on top.
 * Not drawn while What's new is already on screen (App passes null).
 */
/** What the floating note says. Kept to two lines at 320 wide in a wide font: see above. */
const FLOATING = 'A new version is ready. Restart to use it.'

/** Restart now and What's new, side by side. */
const ROW = { flexDirection: 'row', alignItems: 'center', gap: space.sm }

export default function UpdateReady({ over = false, onWhatsNew = null }) {
  const updates = useUpdates()
  const open = updates.phase === 'ready' && !updates.dismissed
  /* The waiting update's lines, asked for while the card is up, so What's new has them when it opens. */
  useEffect(() => {
    if (open) askWaiting(updates.waitingVersion)
  }, [open, updates.waitingVersion])
  if (over) {
    return (
      <Toast open={open} yields>
        <Note tone="warn" onDismiss={dismissReady}>
          {FLOATING}
        </Note>
        <View style={ROW}>
          <Press label="Restart now" tone="signal" height={44} grow onPress={() => applyNow()} />
          {onWhatsNew ? <WhatsNewLink onPress={onWhatsNew} /> : null}
        </View>
      </Toast>
    )
  }
  if (!open) return null
  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm }}>
      <Note tone="warn" onDismiss={dismissReady}>
        A new version of the app is ready. Restart to use it — it takes a second.
      </Note>
      <View style={ROW}>
        <Press label="Restart now" tone="signal" grow onPress={() => applyNow()} />
        {onWhatsNew ? <WhatsNewLink onPress={onWhatsNew} /> : null}
      </View>
    </View>
  )
}
