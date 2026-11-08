import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { color, font, radius, space } from '../lib/theme'
import { tick } from '../lib/feedback'
import { trialOnOffer, usePurchase } from '../lib/purchases'
import { useDemo } from '../lib/demo'
import { DEMO_NUDGE_AFTER_MS, DEMO_NUDGE_GO, DEMO_TRIAL_NUDGE } from '../lib/trial-words'

const KEY = 'fractal.trialNudgeDismissed'

/**
 * ONE CARD, AFTER A FEW MINUTES IN THE DEMO: "Like it? Plug in your unit and
 * try everything free for 7 days." (7 November 2026.) Once: its × puts it
 * away for good. The demo itself stays free and unlimited, with no account;
 * this only points at the trial, and only where this copy offers one.
 * Tapped, the purchase page, whose trial button asks for an account first.
 */
export default function DemoTrialNudge({ onUnlock, waiting = false }) {
  const demo = useDemo()
  const purchase = usePurchase()
  const [gone, setGone] = useState(null)
  const [due, setDue] = useState(false)

  useEffect(() => {
    let alive = true
    AsyncStorage.getItem(KEY)
      .then((v) => alive && setGone(v === 'yes'))
      .catch(() => alive && setGone(false))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!demo) return undefined
    const timer = setTimeout(() => setDue(true), DEMO_NUDGE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [demo])

  if (!demo || !due || gone !== false || waiting || !onUnlock || !trialOnOffer(purchase)) return null

  const put = () => {
    tick()
    setGone(true)
    AsyncStorage.setItem(KEY, 'yes').catch(() => {})
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        padding: space.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: color.signal,
        backgroundColor: color.signalWash
      }}
    >
      <Text style={{ flex: 1, color: color.silk, fontSize: font.small, lineHeight: font.small * 1.45 }}>{DEMO_TRIAL_NUDGE}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={DEMO_TRIAL_NUDGE}
        onPress={() => {
          tick()
          onUnlock()
        }}
        style={({ pressed }) => ({
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          borderRadius: radius.pill,
          backgroundColor: pressed ? color.silkFaint : color.signal
        })}
      >
        <Text style={{ color: color.onSignal, fontSize: font.small, fontWeight: '700' }}>{DEMO_NUDGE_GO}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Put this away" onPress={put} hitSlop={10} style={{ paddingHorizontal: space.xs }}>
        <Text style={{ color: color.silkDim, fontSize: font.lead }}>×</Text>
      </Pressable>
    </View>
  )
}
