import { useEffect } from 'react'
import { Linking, Platform, Text, View } from 'react-native'
import { color, font, space } from '../lib/theme'
import { WHATS_NEW_URL } from '../lib/affiliation'
import { SHOWN_IN_APP, daysFor } from '../lib/whatsNew'
import { daysFromFile, withWaiting } from '../lib/whats-new-rule'
import { askWaiting, useWaitingList } from '../lib/whatsNewWaiting'
import { useUpdates } from '../lib/updates'
import { useStoreNote } from '../lib/storeVersion'
import Press from '../components/Press'

/**
 * Settings → About → What's new: what each update changed, newest first.
 *
 * "Under the about menu can we make a change log that shows what each
 * update change was made? Needs to be user friendly." (Justin, 1 November
 * 2026.) The newest SHOWN_IN_APP days only, so the page stays short and
 * opens with no signal (the list travels inside each update); every day
 * there has been is on the website, one tap away at the foot. The list is
 * shared/whats-new.json, the same one the website's page is made from.
 */
export const daysHere = () => daysFor(Platform.OS).slice(0, SHOWN_IN_APP)

/** The About row's small line: when the newest update was. */
export const latestLine = () => {
  const [newest] = daysHere()
  return newest ? `Latest: ${newest.day}` : 'What each update changed'
}

/*
 * AND WHAT IS NOT ON THE PHONE YET. The list above travels inside each
 * update, so it is one short while a downloaded update waits for a restart
 * (the card's What's new opens this page then: components/UpdateReady), and
 * an old store copy stops getting updates altogether (components/
 * NewerInStore). In either case the website's copy is read
 * (lib/whatsNewWaiting.js) and its newer days go on top, in the same layout
 * (lib/whats-new-rule.js withWaiting): up to the waiting update's version,
 * or all of them for the newer store version. With no signal, the phone's
 * own list, as before.
 */
export default function WhatsNew() {
  const updates = useUpdates()
  const store = useStoreNote()
  const waiting = updates.phase === 'ready'
  const behind = waiting || Boolean(store.note)
  const upTo = store.note ? null : updates.waitingVersion
  const fetched = useWaitingList()
  useEffect(() => {
    if (behind) askWaiting(upTo)
  }, [behind, upTo])
  const days = behind && fetched.file ? withWaiting(daysHere(), daysFromFile(fetched.file, Platform.OS), { upTo }).slice(0, SHOWN_IN_APP) : daysHere()
  return (
    <View style={{ gap: space.xl }}>
      {days.map((d) => (
        <View key={d.date} style={{ gap: space.xs }}>
          <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.body, fontWeight: '700' }}>
            {d.day}
          </Text>
          <Text style={{ color: color.silkDim, fontSize: font.small }}>{`Version ${d.version}`}</Text>
          {d.lines.map((line) => (
            <View key={line} style={{ flexDirection: 'row', gap: space.sm, marginTop: space.xs }}>
              <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: 22 }}>•</Text>
              <Text style={{ flex: 1, color: color.silk, fontSize: font.body, lineHeight: 22 }}>{line}</Text>
            </View>
          ))}
        </View>
      ))}
      <Press label="All updates" sub="On the website" height={52} onPress={() => Linking.openURL(WHATS_NEW_URL).catch(() => {})} />
    </View>
  )
}
