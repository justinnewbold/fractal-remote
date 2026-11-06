import { Pressable, Text } from 'react-native'

import { color, font, space } from '../lib/theme'
import { tick } from '../lib/feedback'
import { WHATS_NEW_LINK } from '../lib/whats-new-rule'

/* The least a thumb is given (Press's THUMB). */
const THUMB = 44

/**
 * WHAT'S NEW, AS A LINK ON A NEW-VERSION CARD: the over-the-air one
 * (UpdateReady, floating over Play and in the column) and the store one
 * (NewerInStore). "Can you have a link that says what's new? And have that
 * be a link that takes them straight to the part of the app that shows them
 * what's new?" (Justin, 6 November 2026.) It opens Settings → About →
 * What's new; the card's own button stays the card's main answer, so this is
 * drawn as words, the way the gear-sharing card's privacy link is, beside it.
 *
 * Words alone would be 20pt tall, so the press reaches to the thumb's 44 and
 * the button's own height beside it, with the words in the middle.
 */
export default function WhatsNewLink({ onPress }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint="Opens the list of what each update changed"
      hitSlop={space.xs}
      onPress={() => {
        tick()
        onPress?.()
      }}
      style={({ pressed }) => ({ minHeight: THUMB, alignSelf: 'stretch', justifyContent: 'center', paddingHorizontal: space.sm, opacity: pressed ? 0.5 : 1 })}
    >
      <Text numberOfLines={1} style={{ color: color.signal, fontSize: font.small, fontWeight: '600', textDecorationLine: 'underline' }}>
        {WHATS_NEW_LINK}
      </Text>
    </Pressable>
  )
}
