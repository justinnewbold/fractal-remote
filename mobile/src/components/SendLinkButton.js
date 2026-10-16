import { useEffect, useState, useSyncExternalStore } from 'react'
import { AccessibilityInfo } from 'react-native'

import { TAP } from '../lib/theme'
import { sendDownloadLink } from '../lib/downloadLink'
import { linkSender, sendLinkSaid } from '../lib/sendLink'
import Press from './Press'

/*
 * One memory for the whole app (lib/sendLink.js says why): a link sent from
 * the waiting screen reads as sent on the play screen and in Phone & computer.
 */
const sender = linkSender(sendDownloadLink)

/**
 * "Send me the download link", under "No computer is signed in with this
 * account yet" on the three screens that say it: the waiting screen, the play
 * screen's card and Phone & computer.
 *
 * `email` is the account's own, the one the words above it name — never a
 * typed one. With none, nothing is drawn.
 *
 * A label and nothing else, at a fixed `height` (44 on the play screen's
 * card, like the buttons beside it), so Sending…, Sent and Didn't send are
 * all the same size and the card never grows under a thumb. The whole
 * sentence, with the reason a send failed, goes to a screen reader instead.
 * Dimmed only while Sending…: Sent is drawn at full strength so it can be
 * read, and a tap on it does nothing anyway.
 *
 * Its own file, not a part of NoComputer.js: on the phone the words about
 * the download are words, never a link to tap through to a page of
 * computer installers (test/no-computer.mjs holds that file to it). This
 * sends the link to an inbox, which is where it is any use.
 */
export default function SendLinkButton({ email, height = TAP }) {
  const phase = useSyncExternalStore(sender.watch, () => sender.phase(email), () => sender.phase(email))
  /* "Sent" runs out after ten minutes; draw again then, so the button is a button again. */
  const [, redraw] = useState(0)
  useEffect(() => {
    const left = sender.sentLeft(email)
    if (!(left > 0)) return undefined
    const t = setTimeout(() => redraw((n) => n + 1), left + 50)
    return () => clearTimeout(t)
  }, [email, phase])

  if (!String(email || '').trim()) return null
  const said = sendLinkSaid(phase, email)
  return (
    <Press
      label={said.label}
      accessibilityLabel={said.spoken}
      height={height}
      disabled={said.busy}
      onPress={() =>
        sender.press(email).then((out) => {
          if (!out) return
          /* Said out loud on both phones: the label changing is not news a screen reader reads. */
          const now = sendLinkSaid(sender.phase(email), email, sender.why(email))
          AccessibilityInfo.announceForAccessibility?.(now.spoken)
        })
      }
    />
  )
}
