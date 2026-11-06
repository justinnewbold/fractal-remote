import { Linking, ScrollView, Text, View } from 'react-native'

import { SHARE_AGAIN, SHARE_DETAILS, SHARE_DETAILS_URL, SHARE_NO, SHARE_TITLE, SHARE_YES, shareWords } from '../lib/gear-share-rules'
import { color, font, radius, space, TAP } from '../lib/theme'
import { cardCorner, glassCard } from '../lib/glass'
import Press from './Press'

/**
 * "HELP MAKE FRACTAL REMOTE BETTER?" ONCE, AND OFF UNLESS THEY SAY YES.
 *
 * The question behind Developer → What works (lib/gear-share-rules.js): may
 * this device send a short note about which gear connected and whether it
 * answered. Our own question, not Apple's tracking prompt, because nothing
 * here is tracking: no account, no install number, nothing to anybody else.
 *
 * WHERE IT COMES. Drawn by App.js in place of Play, never over it, and only
 * once everything before it is done: after the "An independent app" card,
 * after the walkthrough, after the sign-in and the purchase page, and never in
 * the demo, so the App Review demo is never interrupted by it, and the card
 * Fractal Audio asked for is never sharing the screen with it. Once per
 * install: either button is an answer, kept under its own key, and Settings →
 * Troubleshooting changes it any time.
 *
 * No Yes is assumed: "No thanks" and leaving the app without answering both
 * leave it off. The words say exactly what goes and what never does, and a
 * test holds them to what the note really carries.
 *
 * ONCE MORE FOR A YES TO LESS (`again`): somebody who said Yes before 4
 * November 2026 said it to words with no USB cable and no times in them, so
 * the card comes back once, saying so first (SHARE_AGAIN), and until it is
 * answered their notes carry only what those words did (lib/gear-share-rules
 * createGearSharer).
 */
export default function GearShareNotice({ onAnswer, again = false }) {
  const [what, never, change] = shareWords()
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: space.xl }}>
      {/* Centred by a view that grows with the card, as IndependentNotice is, so a tall card scrolls rather than being cut. */}
      <View style={{ flexGrow: 1, justifyContent: 'center' }}>
        <View
          accessibilityViewIsModal
          style={{
            gap: space.lg,
            padding: space.xl,
            /* A card of frosted glass (lib/glass), rimmed, with the light along its top. */
            ...glassCard({ bordered: true }),
            borderRadius: cardCorner(radius.lg),
            borderWidth: 1
          }}
        >
          <Text accessibilityRole="header" style={{ color: color.silk, fontSize: font.title, fontWeight: '800' }}>
            {SHARE_TITLE}
          </Text>
          {again ? <Text style={{ color: color.silk, fontSize: font.body, lineHeight: Math.round(font.body * 1.45), fontWeight: '600' }}>{SHARE_AGAIN}</Text> : null}
          <Text style={{ color: color.silk, fontSize: font.body, lineHeight: Math.round(font.body * 1.45) }}>{what}</Text>
          <Text style={{ color: color.silk, fontSize: font.body, lineHeight: Math.round(font.body * 1.45), fontWeight: '600' }}>{never}</Text>
          <Text style={{ color: color.silkDim, fontSize: font.small, lineHeight: Math.round(font.small * 1.45) }}>{change}</Text>
          {/* Every field, word for word, on the privacy page: the card says it short (lib/gear-share-rules SHARE_DETAILS). */}
          <Text
            accessibilityRole="link"
            onPress={() => Linking.openURL(SHARE_DETAILS_URL).catch(() => {})}
            style={{ color: color.signal, fontSize: font.small, fontWeight: '600', textDecorationLine: 'underline' }}
          >
            {SHARE_DETAILS}
          </Text>
          <Press label={SHARE_YES} tone="signal" on height={TAP} onPress={() => onAnswer?.(true)} />
          <Press label={SHARE_NO} height={TAP} onPress={() => onAnswer?.(false)} />
        </View>
      </View>
    </ScrollView>
  )
}
