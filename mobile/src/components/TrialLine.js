import { Pressable, Text } from 'react-native'

import { color, font, radius, space } from '../lib/theme'
import { tick } from '../lib/feedback'
import { usePurchase } from '../lib/purchases'
import { useDemo } from '../lib/demo'
import { trialLine } from '../lib/trial-words'

/**
 * THE FREE TRIAL'S DAYS, AT THE TOP OF PLAY.
 *
 * "Trial: 3 days left · Unlock", and on its last day "Trial ends today ·
 * Unlock" (7 November 2026). Tapped, the purchase page, to buy: buying ends
 * the trial and makes it the full version for good. Only while a trial runs,
 * never in the demo, and never once bought.
 */
export default function TrialLine({ onUnlock }) {
  const purchase = usePurchase()
  const demo = useDemo()
  const words = !demo && !purchase.unlocked ? trialLine(purchase.trialEndsAt) : null
  if (!words || !onUnlock) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${words}. Opens the purchase page.`}
      onPress={() => {
        tick()
        onUnlock()
      }}
      hitSlop={6}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: color.signal,
        backgroundColor: pressed ? color.signalWash : 'transparent'
      })}
    >
      <Text style={{ color: color.signal, fontSize: font.small, fontWeight: '700' }}>{words}</Text>
    </Pressable>
  )
}
