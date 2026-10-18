import AsyncStorage from '@react-native-async-storage/async-storage'
import { ScrollView, Text, View } from 'react-native'

import { NOT_AFFILIATED, STARTUP_NOTICE_TITLE, SUPPORT_LINE } from '../lib/affiliation'
import { color, font, radius, space, TAP } from '../lib/theme'
import Press from './Press'

/**
 * WHOSE APP THIS IS NOT, SAID AT STARTUP, ONCE.
 *
 * Fractal Audio's letter of 18 October 2026 asks for "a clear statement on
 * startup" that the app "is independently developed and is not affiliated
 * with, endorsed by, or supported by Fractal Audio Systems, LLC", and for
 * support to come through Justin's own channels. Justin: "I wanna comply as
 * much as I can." Until now the only disclaimer a player met without going
 * looking was the faint line at the foot of the walkthrough's first screen,
 * on the first run only, so everybody who had the app before 23 September
 * 2026 had never seen one at all.
 *
 * So this is a card of its own: the heading, Fractal's sentence, where help
 * comes from, and OK. Drawn by App.js in the launch gate, after the spinner
 * and before everything else (the walkthrough, the sign-in, "Finding your
 * computer…", Play), and in place of them rather than over them, so it is
 * never laid over Play with a song going. The demo is no exception.
 *
 * ONCE PER INSTALL, UNDER A KEY OF ITS OWN. A new key, rather than the
 * walkthrough's, so every phone that already had the app sees it once after
 * the update that brought it, and a brand-new install sees it before the
 * walkthrough. Remembered when OK is pressed, because OK is the
 * acknowledgement; a phone that cannot read its own storage is shown it,
 * because the failure that matters here is the one where nobody ever saw it.
 *
 * Words from shared/affiliation.mjs (lib/affiliation, generated), the same
 * strings the browser's card and every website page carry.
 */
const KEY = 'fractal.independent.v1'

export async function independentNoticeSeen() {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'done'
  } catch {
    /* Storage that will not answer: shown, not skipped. */
    return false
  }
}

/*
 * THE ADDRESS BREAKS AT ITS SLASH, IF IT HAS TO BREAK. On a 320-wide phone
 * "fractal.newbold.cloud/support.html." is wider than the card's column, and
 * a word with nowhere to break is cut wherever the line runs out: it read
 * "…/support.ht" and then "ml." on the next line. A zero-width space after
 * the slash is somewhere to break that nobody sees or hears, so a narrow
 * screen or a large text size gets "fractal.newbold.cloud/" and then
 * "support.html.", and a wide one gets the line exactly as written.
 */
const HELP_LINE = SUPPORT_LINE.replace('.cloud/', '.cloud/\u200B')

export function markIndependentNotice() {
  AsyncStorage.setItem(KEY, 'done').catch(() => {
    /* Costs one more showing at the next launch, and nothing else. */
  })
}

export default function IndependentNotice({ onDone }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: space.xl }}>
      {/* Centred by a view that grows with the card, not by the scroll view
          itself: a card taller than a small phone with a large text size then
          scrolls, rather than being cut at both ends (test/mobile.mjs, "no
          scrolling screen centres content it is too small to hold"). */}
      <View style={{ flexGrow: 1, justifyContent: 'center' }}>
      <View
        accessibilityViewIsModal
        style={{
          gap: space.lg,
          padding: space.xl,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: color.rule,
          backgroundColor: color.panel
        }}
      >
        <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '800' }}>
          {STARTUP_NOTICE_TITLE}
        </Text>
        <Text style={{ color: color.silk, fontSize: font.lead, lineHeight: Math.round(font.lead * 1.4) }}>
          {NOT_AFFILIATED}
        </Text>
        <Text style={{ color: color.silkDim, fontSize: font.body, lineHeight: Math.round(font.body * 1.45) }}>
          {HELP_LINE}
        </Text>
        <Press label="OK" tone="signal" on height={TAP} onPress={() => onDone?.()} />
      </View>
      </View>
    </ScrollView>
  )
}
